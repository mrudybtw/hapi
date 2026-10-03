import { hashObject } from '@/utils/deterministicJson'
import { MessageQueue2 } from '@/utils/MessageQueue2'
import { registerKillSessionHandler } from '@/claude/registerKillSessionHandler'
import { createRunnerLifecycle, setControlledByUser } from '@/agent/runnerLifecycle'
import { bootstrapExistingSession, bootstrapSession } from '@/agent/sessionFactory'
import { registerSessionConfigRpc } from '@/agent/sessionConfigRpc'
import { formatMessageWithAttachments } from '@/utils/attachmentFormatter'
import { getInvokedCwd } from '@/utils/invokedCwd'
import { logger } from '@/ui/logger'
import type { PermissionMode } from '@hapi/protocol/types'
import type { AgentState } from '@/api/types'
import { DshRemoteLauncher } from './dshRemoteLauncher'
import { DshSession } from './session'
import type { DshMode } from './types'

export async function runDsh(opts: {
    startedBy?: 'runner' | 'terminal'
    startingMode?: 'remote'
    existingSessionId?: string
    /** Fresh machine-spawn stub (`--hapi-session-id`); adopt via bootstrapSession. */
    reservedSessionId?: string
    workingDirectory?: string
} = {}): Promise<void> {
    const workingDirectory = opts.workingDirectory ?? getInvokedCwd()
    const startedBy = opts.startedBy ?? 'terminal'
    const startingMode = 'remote' as const
    const initialState: AgentState = {
        controlledByUser: false,
        startingMode
    }

    const bootstrap = opts.existingSessionId
        ? await bootstrapExistingSession({
            sessionId: opts.existingSessionId,
            flavor: 'dsh',
            startedBy,
            workingDirectory
        })
        : await bootstrapSession({
            flavor: 'dsh',
            startedBy,
            workingDirectory,
            agentState: initialState,
            reservedSessionId: opts.reservedSessionId
        })
    const { api, session } = bootstrap
    setControlledByUser(session, startingMode)

    const queue = new MessageQueue2<DshMode>((mode) => hashObject(mode))
    const sessionRef: { current: DshSession | null } = { current: null }
    const launcherRef: { current: DshRemoteLauncher | null } = { current: null }

    session.onUserMessage((message, localId) => {
        queue.push(
            formatMessageWithAttachments(message.content.text, message.content.attachments),
            'dsh',
            localId
        )
    })
    session.onCancelQueuedMessage((localId) => queue.cancelByLocalId(localId))

    const lifecycle = createRunnerLifecycle({
        session,
        logTag: 'dsh',
        stopKeepAlive: () => sessionRef.current?.stopKeepAlive(),
        onBeforeClose: () => launcherRef.current?.kill()
    })
    lifecycle.registerProcessHandlers()
    registerKillSessionHandler(session.rpcHandlerManager, lifecycle, session)

    const dshSession = new DshSession({
        api,
        client: session,
        path: workingDirectory,
        logPath: logger.getLogPath(),
        messageQueue: queue,
        onModeChange: () => {},
        startedBy
    })
    const launcher = new DshRemoteLauncher(dshSession)
    sessionRef.current = dshSession
    launcherRef.current = launcher

    // Model picked in the HAPI UI arrives as the generic `set-session-config`
    // RPC. Record it on the session; the launcher applies it through ACP
    // (`session/set_config_option`) at the next turn boundary.
    registerSessionConfigRpc<PermissionMode>({
        rpcHandlerManager: session.rpcHandlerManager,
        flavor: 'dsh',
        modelMode: 'nullable',
        onApply: (config) => {
            if (config.model !== undefined) {
                dshSession.setModel(config.model)
            }
        }
    })

    let crashed = false
    try {
        await launcher.launch()
    } catch (error) {
        crashed = true
        lifecycle.markCrash(error)
    } finally {
        if (!crashed) lifecycle.setSessionEndReason('completed')
        await lifecycle.cleanupAndExit()
    }
}
