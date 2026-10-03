import { ApiClient, ApiSessionClient } from '@/lib'
import { MessageQueue2 } from '@/utils/MessageQueue2'
import { AgentSessionBase } from '@/agent/sessionBase'
import type { SessionModel } from '@/api/types'
import type { DshMode } from './types'

/** Remote-only HAPI session wrapper for the fresh-session DSH ACP server. */
export class DshSession extends AgentSessionBase<DshMode> {
    readonly startedBy: 'runner' | 'terminal'

    constructor(opts: {
        api: ApiClient
        client: ApiSessionClient
        path: string
        logPath: string
        messageQueue: MessageQueue2<DshMode>
        onModeChange: (mode: 'local' | 'remote') => void
        startedBy: 'runner' | 'terminal'
    }) {
        super({
            api: opts.api,
            client: opts.client,
            path: opts.path,
            logPath: opts.logPath,
            sessionId: null,
            messageQueue: opts.messageQueue,
            onModeChange: opts.onModeChange,
            mode: 'remote',
            sessionLabel: 'DshSession',
            sessionIdLabel: 'DeepSeek Harness ACP',
            // The official ACP server supports fresh sessions only. Keep its
            // process-local id out of HAPI metadata so inactive rows cannot
            // advertise a resume path the server does not implement.
            applySessionIdToMetadata: (metadata) => metadata
        })
        this.startedBy = opts.startedBy
    }

    sendAgentMessage = (message: unknown): void => {
        this.client.sendAgentMessage(message)
    }

    sendSessionEvent = (event: Parameters<ApiSessionClient['sendSessionEvent']>[0]): void => {
        this.client.sendSessionEvent(event)
    }

    /**
     * Records the model requested by the hub. The launcher applies it to the
     * ACP session on the next turn boundary; it never switches mid-prompt.
     */
    setModel = (model: SessionModel): void => {
        this.model = model
    }
}
