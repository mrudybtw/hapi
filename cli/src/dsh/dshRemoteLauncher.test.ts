import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageQueue2 } from '@/utils/MessageQueue2'
import type { DshMode } from './types'

type ModelsMetadata = {
    availableModels: Array<{ modelId: string; name?: string }>
    currentModelId: string | null
}

const harness = vi.hoisted(() => ({
    backend: null as Record<string, ReturnType<typeof vi.fn>> | null,
    newSessionConfig: null as unknown,
    prompts: [] as unknown[][],
    modelsMetadata: undefined as ModelsMetadata | undefined,
    rejectSwitch: false
}))

vi.mock('./utils/dshBackend', () => ({
    createDshBackend: vi.fn(() => {
        const backend = {
            initialize: vi.fn(async () => {}),
            newSession: vi.fn(async (config: unknown) => {
                harness.newSessionConfig = config
                return 'dsh-session-1'
            }),
            prompt: vi.fn(async (_sessionId: string, content: unknown[], onUpdate: (message: unknown) => void) => {
                harness.prompts.push(content)
                onUpdate({ type: 'text', text: 'answer' })
            }),
            cancelPrompt: vi.fn(async () => {}),
            onStderrError: vi.fn(),
            onPermissionRequest: vi.fn(),
            disconnect: vi.fn(async () => {}),
            getSessionModelsMetadata: vi.fn(() => harness.modelsMetadata),
            getConfigOptionByCategory: vi.fn(() => ({ id: 'model', category: 'model' })),
            setConfigOption: vi.fn(async () => {
                if (harness.rejectSwitch) throw new Error('boom')
            }),
            setModel: vi.fn(async () => {})
        }
        harness.backend = backend
        return backend
    })
}))

vi.mock('@/modules/common/permission/AcpPermissionHandler', () => ({
    AcpPermissionHandler: class {
        async cancelAll(): Promise<void> {}
    }
}))

vi.mock('@/ui/ink/RemoteModeDisplay', () => ({ RemoteModeDisplay: () => null }))
vi.mock('@/ui/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }))

import { DshRemoteLauncher } from './dshRemoteLauncher'

function createSession(options: { model?: string | null } = {}) {
    const queue = new MessageQueue2<DshMode>((mode) => JSON.stringify(mode))
    queue.push('first', 'dsh')
    queue.close()

    let model = options.model ?? null

    return {
        path: '/tmp/dsh-test',
        logPath: '/tmp/dsh-test/hapi.log',
        client: { rpcHandlerManager: { registerHandler: vi.fn() } },
        queue,
        sessionId: null as string | null,
        getPermissionMode: () => 'default' as const,
        getModel: () => model,
        setModel: vi.fn((next: string | null) => {
            model = next
        }),
        pushKeepAlive: vi.fn(),
        onThinkingChange: vi.fn(),
        sendAgentMessage: vi.fn(),
        sendSessionEvent: vi.fn()
    }
}

function findHandler(session: ReturnType<typeof createSession>, method: string) {
    const call = session.client.rpcHandlerManager.registerHandler.mock.calls
        .find(([name]: [string]) => name === method)
    return call as [string, () => Promise<unknown>] | undefined
}

describe('DshRemoteLauncher', () => {
    afterEach(() => {
        harness.backend = null
        harness.newSessionConfig = null
        harness.prompts = []
        harness.modelsMetadata = undefined
        harness.rejectSwitch = false
    })

    it('creates a fresh ACP session without MCP injection and forwards text prompts', async () => {
        const session = createSession()
        const launcher = new DshRemoteLauncher(session as never)

        await launcher.launch()

        expect(harness.backend?.newSession).toHaveBeenCalledWith({
            cwd: '/tmp/dsh-test',
            mcpServers: []
        })
        expect(harness.prompts).toEqual([[{ type: 'text', text: 'first' }]])
        expect(session.sendAgentMessage).toHaveBeenCalledWith({
            type: 'message',
            message: 'answer'
        })
        expect(session.sendSessionEvent).toHaveBeenCalledWith({ type: 'ready' })
        expect(harness.backend?.disconnect).toHaveBeenCalled()
    })

    it('applies a model picked in the UI through the ACP config option', async () => {
        harness.modelsMetadata = {
            availableModels: [{ modelId: 'deepseek-v4-flash' }, { modelId: 'deepseek-v4-pro' }],
            currentModelId: 'deepseek-v4-flash'
        }
        const session = createSession({ model: 'deepseek-v4-pro' })
        const launcher = new DshRemoteLauncher(session as never)

        await launcher.launch()

        expect(harness.backend?.setConfigOption).toHaveBeenCalledWith(
            'dsh-session-1',
            'model',
            'deepseek-v4-pro'
        )
        expect(harness.backend?.setModel).not.toHaveBeenCalled()
    })

    it('does not call the agent when the requested model is already active', async () => {
        harness.modelsMetadata = {
            availableModels: [{ modelId: 'deepseek-v4-flash' }],
            currentModelId: 'deepseek-v4-flash'
        }
        const session = createSession({ model: 'deepseek-v4-flash' })
        const launcher = new DshRemoteLauncher(session as never)

        await launcher.launch()

        expect(harness.backend?.setConfigOption).not.toHaveBeenCalled()
    })

    it('rolls the session back when the agent rejects the switch', async () => {
        harness.modelsMetadata = {
            availableModels: [{ modelId: 'deepseek-v4-pro' }],
            currentModelId: 'deepseek-v4-flash'
        }
        harness.rejectSwitch = true
        const session = createSession({ model: 'deepseek-v4-pro' })
        const launcher = new DshRemoteLauncher(session as never)

        await launcher.launch()

        expect(harness.backend?.setConfigOption).toHaveBeenCalled()
        expect(session.setModel).toHaveBeenCalledWith('deepseek-v4-flash')
        expect(session.getModel()).toBe('deepseek-v4-flash')
        expect(session.sendSessionEvent).toHaveBeenCalledWith({
            type: 'message',
            message: expect.stringContaining('Failed to switch model to deepseek-v4-pro')
        })
    })

    it('exposes the ACP model catalog over the ListDshModels RPC', async () => {
        harness.modelsMetadata = {
            availableModels: [
                { modelId: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
                { modelId: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
            ],
            currentModelId: 'deepseek-v4-flash'
        }
        const session = createSession()
        const launcher = new DshRemoteLauncher(session as never)

        await launcher.launch()

        const handler = findHandler(session, 'listDshModels')
        expect(handler).toBeDefined()
        await expect(handler![1]()).resolves.toEqual({
            success: true,
            availableModels: [
                { modelId: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
                { modelId: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
            ],
            currentModelId: 'deepseek-v4-flash'
        })
    })

    it('reports a failed ListDshModels RPC when the agent exposes no catalog', async () => {
        const session = createSession()
        const launcher = new DshRemoteLauncher(session as never)

        await launcher.launch()

        const handler = findHandler(session, 'listDshModels')
        expect(handler).toBeDefined()
        await expect(handler![1]()).resolves.toEqual({
            success: false,
            error: 'DSH model metadata is not available'
        })
    })
})
