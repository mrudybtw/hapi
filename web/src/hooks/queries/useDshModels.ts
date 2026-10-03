import { useQuery } from '@tanstack/react-query'
import type { DshModelsResponse } from '@hapi/protocol/apiTypes'
import type { ApiClient } from '@/api/client'
import type { OpencodeModelSummary } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'

export function shouldRetryDshModelsQuery(failureCount: number): boolean {
    return failureCount < 3
}

const MAX_DSH_MODEL_DISCOVERY_POLLS = 10

export function getDshModelsRefetchInterval(
    enabled: boolean,
    data: DshModelsResponse | undefined,
    pollCount: number
): 1000 | false {
    if (!enabled || pollCount >= MAX_DSH_MODEL_DISCOVERY_POLLS) {
        return false
    }
    if (!data) {
        return 1000
    }
    if (data.success === false) {
        return 1000
    }
    return (data.availableModels?.length ?? 0) > 0 ? false : 1000
}

/**
 * Model catalog for a DeepSeek Harness session. The DSH ACP server advertises
 * its models in the `session/new` configOptions block; the session process
 * caches them and serves them over the `listDshModels` RPC.
 */
export function useDshModels(args: {
    api: ApiClient | null
    sessionId?: string | null
    enabled?: boolean
}): {
    availableModels: OpencodeModelSummary[]
    currentModelId: string | null
    isLoading: boolean
    error: string | null
} {
    const { api, sessionId } = args
    const enabled = Boolean(args.enabled && api && sessionId)

    const query = useQuery({
        queryKey: sessionId
            ? queryKeys.sessionDshModels(sessionId)
            : ['session-dsh-models', 'unknown'] as const,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            if (!sessionId) {
                throw new Error('DSH models target unavailable')
            }
            return await api.getSessionDshModels(sessionId)
        },
        enabled,
        staleTime: 30_000,
        retry: (failureCount) => shouldRetryDshModelsQuery(failureCount),
        refetchInterval: (query) => getDshModelsRefetchInterval(
            enabled,
            query.state.data as DshModelsResponse | undefined,
            query.state.dataUpdateCount + query.state.errorUpdateCount
        ),
    })

    return {
        availableModels: query.data?.availableModels ?? [],
        currentModelId: query.data?.currentModelId ?? null,
        isLoading: query.isLoading,
        error: query.data?.success === false
            ? (query.data.error ?? 'Failed to load DSH models')
            : query.error instanceof Error
                ? query.error.message
                : query.error
                    ? 'Failed to load DSH models'
                    : null,
    }
}
