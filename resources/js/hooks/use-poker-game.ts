import {
    useCallback,
    useReducer,
    useRef,
    useState,
    type Dispatch,
} from 'react';
import { toast } from 'sonner';
import PokerSnapshotsController from '@/actions/App/Http/Controllers/Poker/PokerSnapshotsController';
import { useServerOffset } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { gameReducer, type GameAction } from '@/lib/poker/game-reducer';
import type { PokerSnapshot, PokerTask } from '@/lib/poker/types';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/retro/whisper-transport';
import { usePokerChannel, type PokerEvent } from './use-poker-channel';

const SessionExpiredStatuses = [401, 419];

export type GameStatus = 'active' | 'ended' | 'deleted';

export type PokerGameState = {
    snapshot: PokerSnapshot;
    dispatch: Dispatch<GameAction>;
    apply: (action: GameAction) => void;
    refetch: () => Promise<void>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    status: GameStatus;
    online: PresenceMember[];
    connected: boolean;
    reconnecting: boolean;
    presence: WhisperChannel | null;
    sessionExpired: boolean;
    serverOffset: number;
};

export function usePokerGame(initial: PokerSnapshot): PokerGameState {
    const { t } = useTrans();
    const [snapshot, dispatch] = useReducer(gameReducer, initial);
    const [status, setStatus] = useState<GameStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const isActive = useRef(true);
    const latestRefetch = useRef(0);
    const bufferedActions = useRef<GameAction[] | null>(null);
    const latestSnapshot = useRef(snapshot);
    const gameId = initial.game.id;
    const serverOffset = useServerOffset(snapshot.serverTime);

    latestSnapshot.current = snapshot;

    /**
     * While a refetch is in flight, broadcast actions are held back and
     * replayed after its snapshot so events committed after the snapshot
     * was built are not wiped by it.
     */
    const apply = useCallback((action: GameAction) => {
        if (bufferedActions.current) {
            bufferedActions.current.push(action);

            return;
        }

        dispatch(action);
    }, []);

    const flushBufferedActions = useCallback(() => {
        const actions = bufferedActions.current ?? [];

        bufferedActions.current = null;

        for (const action of actions) {
            dispatch(action);
        }
    }, []);

    const end = useCallback((reason: Exclude<GameStatus, 'active'>) => {
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

        bufferedActions.current ??= [];

        try {
            const fresh = await retroRequest<PokerSnapshot>(
                PokerSnapshotsController.show(gameId),
            );

            if (request !== latestRefetch.current || !isActive.current) {
                return;
            }

            dispatch({ type: 'replace', snapshot: fresh });
        } catch (error) {
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
    }, [gameId, end, flushBufferedActions]);

    const onEvent = useCallback(
        ({ name, payload }: PokerEvent) => {
            switch (name) {
                case 'task.saved':
                    apply({
                        type: 'task.upsert',
                        task: payload.task as PokerTask,
                    });
                    break;
                case 'task.deleted':
                    apply({
                        type: 'task.remove',
                        taskId: payload.taskId as string,
                    });
                    break;
                case 'tasks.reordered':
                    apply({
                        type: 'tasks.reorder',
                        taskIds: payload.taskIds as string[],
                    });
                    break;
                case 'vote.changed':
                    if (
                        payload.playerId === latestSnapshot.current.me.playerId
                    ) {
                        void refetch();
                        break;
                    }

                    apply({
                        type: 'vote.changed',
                        roundId: payload.roundId as string,
                        playerId: payload.playerId as string,
                        hasVoted: payload.hasVoted as boolean,
                        votesCount: payload.votesCount as number,
                        version: payload.version as number,
                    });
                    break;
                case 'round.changed':
                case 'game.changed':
                    void refetch();
                    break;
                case 'game.deleted':
                    end('deleted');
                    break;
            }
        },
        [apply, refetch, end],
    );

    const onJoining = useCallback(
        (member: PresenceMember) => {
            const isKnown = latestSnapshot.current.players.some(
                (player) => player.id === member.id,
            );

            if (!isKnown) {
                void refetch();
            }
        },
        [refetch],
    );

    const { online, connected, reconnecting, presence } = usePokerChannel(
        gameId,
        status === 'active',
        { onEvent, onResync: refetch, onJoining },
    );

    const errorMessage = useCallback(
        (error: unknown): string => {
            if (!(error instanceof RetroRequestError)) {
                return t('Something went wrong. Please try again.');
            }

            if (error.status === 0) {
                return t(
                    'The server did not respond in time. Please try again.',
                );
            }

            return (
                error.message || t('Something went wrong. Please try again.')
            );
        },
        [t],
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

            return errorMessage(error);
        },
        [errorMessage],
    );

    /**
     * Every failed mutation (a closed round, a task deleted meanwhile, a
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
        snapshot,
        dispatch,
        apply,
        refetch,
        run,
        handleError,
        status,
        online,
        connected,
        reconnecting,
        presence,
        sessionExpired,
        serverOffset,
    };
}
