import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { toast } from 'sonner';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, requestErrorMessage } from '@/lib/retro/api';

const SessionExpiredStatuses = [401, 419];

export type SessionStatus = 'active' | 'ended' | 'deleted';

type SnapshotSessionOptions = {
    /** A snapshot that did not arrive (lost network, server error) is asked again after this delay. */
    retryTransientMs?: number;
    /** A message of its own for some failures; the shared one for the others. */
    messageFor?: (error: unknown) => string | undefined;
};

function isTransient(error: unknown): boolean {
    return (
        !(error instanceof RetroRequestError) ||
        error.status === 0 ||
        error.status >= 500
    );
}

/**
 * The life of a live session around its reducer: a refetch of the snapshot
 * that holds back broadcast actions while in flight, the end of the session
 * once the server refuses it, and the error handling of every mutation.
 * `fetchReplacement` fetches the snapshot and answers the action that puts
 * it in place.
 */
export function useSnapshotSession<Action>(
    dispatch: Dispatch<Action>,
    fetchReplacement: () => Promise<NoInfer<Action>>,
    options: SnapshotSessionOptions = {},
) {
    const { t } = useTrans();
    const [status, setStatus] = useState<SessionStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const isActive = useRef(true);
    const latestRefetch = useRef(0);
    const bufferedActions = useRef<Action[] | null>(null);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refetchAgain = useRef<() => void>(() => {});
    const latest = useRef({ fetchReplacement, options });

    latest.current = { fetchReplacement, options };

    /**
     * While a refetch is in flight, broadcast actions are held back and
     * replayed after its snapshot so events committed after the snapshot
     * was built are not wiped by it.
     */
    const apply = useCallback(
        (action: Action) => {
            if (bufferedActions.current) {
                bufferedActions.current.push(action);

                return;
            }

            dispatch(action);
        },
        [dispatch],
    );

    const flushBufferedActions = useCallback(() => {
        const actions = bufferedActions.current ?? [];

        bufferedActions.current = null;

        for (const action of actions) {
            dispatch(action);
        }
    }, [dispatch]);

    const end = useCallback((reason: Exclude<SessionStatus, 'active'>) => {
        if (!isActive.current) {
            return;
        }

        isActive.current = false;
        setStatus(reason);
    }, []);

    const refetch = useCallback(async () => {
        if (!isActive.current) {
            return;
        }

        const request = ++latestRefetch.current;
        const { retryTransientMs } = latest.current.options;

        if (retryTimer.current !== null) {
            clearTimeout(retryTimer.current);
            retryTimer.current = null;
        }

        bufferedActions.current ??= [];

        try {
            const replacement = await latest.current.fetchReplacement();

            if (request !== latestRefetch.current || !isActive.current) {
                return;
            }

            dispatch(replacement);
        } catch (error) {
            if (retryTransientMs !== undefined && isTransient(error)) {
                if (request === latestRefetch.current && isActive.current) {
                    retryTimer.current = setTimeout(
                        () => refetchAgain.current(),
                        retryTransientMs,
                    );
                }

                return;
            }

            if (!(error instanceof RetroRequestError)) {
                return;
            }

            if (SessionExpiredStatuses.includes(error.status)) {
                setSessionExpired(true);
            }

            if (error.status === 404) {
                end('deleted');
            }

            if (error.status === 403) {
                end('ended');
            }
        } finally {
            if (request === latestRefetch.current) {
                flushBufferedActions();
            }
        }
    }, [dispatch, end, flushBufferedActions]);

    useEffect(() => {
        refetchAgain.current = () => void refetch();
    }, [refetch]);

    useEffect(
        () => () => {
            if (retryTimer.current !== null) {
                clearTimeout(retryTimer.current);
            }
        },
        [],
    );

    /**
     * Shows the session-expired banner for a 401/419 and returns null;
     * otherwise returns the translated message to show for the failure.
     */
    const handleError = useCallback(
        (error: unknown): string | null => {
            if (
                error instanceof RetroRequestError &&
                SessionExpiredStatuses.includes(error.status)
            ) {
                setSessionExpired(true);

                return null;
            }

            return (
                latest.current.options.messageFor?.(error) ??
                requestErrorMessage(error, t)
            );
        },
        [t],
    );

    /**
     * Every failed mutation (a closed round, an item deleted meanwhile, a
     * role changed by the facilitator) is followed by a fresh snapshot so
     * the screen shows the state the server refused against.
     */
    const run = useCallback(
        async <T>(mutation: Promise<T>): Promise<T | undefined> => {
            try {
                return await mutation;
            } catch (error) {
                const message = handleError(error);

                if (message === null) {
                    return undefined;
                }

                toast.error(message);
                await refetch();

                return undefined;
            }
        },
        [refetch, handleError],
    );

    return {
        apply,
        bufferedActions,
        end,
        handleError,
        isActive,
        refetch,
        run,
        sessionExpired,
        status,
    };
}
