import React from 'react'
import { RPC_METHODS } from '@hapi/protocol/rpcMethods'
import { logger } from '@/ui/logger'
import { convertAgentMessage } from '@/agent/messageConverter'
import type { AgentMessage, PromptContent } from '@/agent/types'
import {
    RemoteLauncherBase,
    type RemoteLauncherDisplayContext,
    type RemoteLauncherExitReason
} from '@/modules/common/remote/RemoteLauncherBase'
import { RemoteModeDisplay } from '@/ui/ink/RemoteModeDisplay'
import { AcpPermissionHandler } from '@/modules/common/permission/AcpPermissionHandler'
import { createDshBackend } from './utils/dshBackend'
import type { DshSession } from './session'

export class DshRemoteLauncher extends RemoteLauncherBase {
    private backend: ReturnType<typeof createDshBackend> | null = null
    private permissionHandler: AcpPermissionHandler | null = null
    private abortController = new AbortController()
    /** Model the ACP server is currently running; tracks pending switches. */
    private currentBackendModel: string | null = null

    constructor(private readonly session: DshSession) {
        super(process.env.DEBUG ? session.logPath : undefined)
    }

    async launch(): Promise<RemoteLauncherExitReason> {
        return this.start({ onExit: () => this.handleExitFromUi() })
    }

    async kill(): Promise<void> {
        if (!this.backend) return
        await this.handleAbort()
    }

    protected createDisplay(context: RemoteLauncherDisplayContext): React.ReactElement {
        return React.createElement(RemoteModeDisplay, {
            ...context,
            agentLabel: 'DeepSeek Harness'
        })
    }

    protected async runMainLoop(): Promise<void> {
        const backend = createDshBackend()
        this.backend = backend
        backend.onStderrError((error) => {
            logger.debug('[dsh-acp] stderr error', error)
            this.session.sendSessionEvent({ type: 'message', message: error.message })
            this.messageBuffer.addMessage(error.message, 'status')
        })

        await backend.initialize()
        const acpSessionId = await backend.newSession({
            cwd: this.session.path,
            // The official DSH ACP composition rejects non-empty MCP servers;
            // its tools are configured by the DSH server itself.
            mcpServers: []
        })
        this.session.sessionId = acpSessionId

        // The `dsh-acp` server advertises its model catalog through the
        // `configOptions` block of `session/new`; AcpSdkBackend merges that into
        // availableModels/currentModelId. Expose it over the session RPC so the
        // hub can forward it to the web UI's model selector.
        this.currentBackendModel = backend.getSessionModelsMetadata?.(acpSessionId)?.currentModelId ?? null
        this.session.client.rpcHandlerManager.registerHandler(RPC_METHODS.ListDshModels, async () => {
            const metadata = backend.getSessionModelsMetadata?.(acpSessionId)
            if (!metadata) {
                return { success: false, error: 'DSH model metadata is not available' }
            }
            return {
                success: true,
                availableModels: metadata.availableModels,
                currentModelId: metadata.currentModelId
            }
        })

        this.permissionHandler = new AcpPermissionHandler(
            this.session.client,
            backend,
            () => undefined
        )
        this.setupAbortHandlers(this.session.client.rpcHandlerManager, {
            onAbort: () => this.handleAbort(),
            onSwitch: () => this.handleExitFromUi()
        })

        while (!this.shouldExit) {
            const batch = await this.session.queue.waitForMessagesAndGetAsString(this.abortController.signal)
            if (!batch) {
                if (this.abortController.signal.aborted && !this.shouldExit) continue
                break
            }

            // Apply a model picked in the HAPI UI before the turn starts. The
            // switch is serialized here (outside session/prompt) so it can never
            // interleave with an in-flight turn.
            await this.applyPendingModel(backend, acpSessionId)

            this.session.onThinkingChange(true)
            this.messageBuffer.addMessage(batch.message, 'user')
            const prompt: PromptContent[] = [{ type: 'text', text: batch.message }]
            try {
                await backend.prompt(acpSessionId, prompt, (message) => this.handleAgentMessage(message))
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                logger.warn('[dsh-acp] prompt failed', { message })
                this.session.sendSessionEvent({ type: 'message', message: `DSH prompt failed: ${message}` })
                this.messageBuffer.addMessage(`DSH prompt failed: ${message}`, 'status')
            } finally {
                this.session.onThinkingChange(false)
                await this.permissionHandler?.cancelAll('Prompt finished')
                if (this.session.queue.size() === 0 && !this.shouldExit) {
                    this.session.sendSessionEvent({ type: 'ready' })
                }
            }
        }
    }

    protected async cleanup(): Promise<void> {
        this.clearAbortHandlers(this.session.client.rpcHandlerManager)
        await this.permissionHandler?.cancelAll('Session ended')
        this.permissionHandler = null
        await this.backend?.disconnect()
        this.backend = null
    }

    private handleAgentMessage(message: AgentMessage): void {
        const converted = convertAgentMessage(message)
        if (converted) this.session.sendAgentMessage(converted)

        switch (message.type) {
            case 'text':
                this.messageBuffer.addMessage(message.text, 'assistant')
                break
            case 'generated_image':
                this.messageBuffer.addMessage(`Generated image: ${message.fileName}`, 'assistant')
                break
            case 'error':
                this.messageBuffer.addMessage(message.message, 'status')
                break
            case 'turn_complete':
                this.messageBuffer.addMessage('Turn complete', 'status')
                break
            case 'usage':
            case 'reasoning':
            case 'tool_call':
            case 'tool_result':
            case 'plan':
                break
            default: {
                const _exhaustive: never = message
                return _exhaustive
            }
        }
    }

    /**
     * Applies a model selected in the HAPI UI. `dsh-acp` implements the ACP
     * session config option (configId "model"), so that is the primary path;
     * `session/set_model` is only a fallback for other DSH ACP servers.
     */
    private async applyPendingModel(
        backend: ReturnType<typeof createDshBackend>,
        acpSessionId: string
    ): Promise<void> {
        const requested = this.session.getModel()
        if (typeof requested !== 'string' || requested.trim().length === 0) return
        const target = requested.trim()
        if (target === this.currentBackendModel) return

        // Use the config id the agent actually advertises instead of assuming "model".
        const optionId = backend.getConfigOptionByCategory?.(acpSessionId, 'model')?.id ?? 'model'
        try {
            try {
                await backend.setConfigOption(acpSessionId, optionId, target)
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                if (!/method not found/i.test(message)) throw error
                // Legacy ACP servers expose only session/set_model.
                await backend.setModel(acpSessionId, target, { flavor: 'dsh' })
            }
            this.currentBackendModel = target
            logger.debug(`[dsh-acp] model switched to ${target}`)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.warn('[dsh-acp] model switch failed', { message })
            // Roll the session back so the hub and UI do not advertise a model
            // the agent is not actually running.
            this.session.setModel(this.currentBackendModel)
            this.session.pushKeepAlive()
            this.session.sendSessionEvent({
                type: 'message',
                message: `Failed to switch model to ${target}: ${message}. Continuing with ${this.currentBackendModel ?? 'the agent default'}.`
            })
        }
    }

    private async handleAbort(): Promise<void> {
        if (this.backend && this.session.sessionId) {
            await this.backend.cancelPrompt(this.session.sessionId)
        }
        await this.permissionHandler?.cancelAll('User aborted')
        this.session.sendSessionEvent({ type: 'message', message: 'Session aborted' })
        this.session.queue.reset()
        this.session.onThinkingChange(false)
        this.abortController.abort()
        this.abortController = new AbortController()
        this.messageBuffer.addMessage('Turn aborted', 'status')
    }

    private async handleExitFromUi(): Promise<void> {
        await this.requestExit('exit', () => this.handleAbort())
    }
}
