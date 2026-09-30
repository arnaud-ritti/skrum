import {
    useCallback,
    useReducer,
    useRef,
    useState,
    type Dispatch,
} from 'react';
import { toast } from 'sonner';
import GameSnapshotsController from '@/actions/App/Http/Controllers/Games/GameSnapshotsController';
import { useServerOffset } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import {
    initialRoomState,
    roomReducer,
    type RoomAction,
} from '@/lib/games/room-reducer';
import type {
    GameDrawingOpAdded,
    GameGuessMade,
    GameLetterPicked,
    GameMask,
    GameRound,
    GameRoomState,
    GameRoundEnded,
    GameSnapshot,
} from '@/lib/games/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import { useGameChannel, type GameEvent } from './use-game-channel';

const SessionExpiredStatuses = [401, 419];

export type RoomStatus = 'active' | 'ended' | 'deleted';

export type GameRoomHook = {
    state: GameRoomState;
    dispatch: Dispatch<RoomAction>;
    apply: (action: RoomAction) => void;
    refetch: () => Promise<void>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    /** Entry point for game events, including those relayed by the retro board (13d). */
    handleEvent: (event: GameEvent) => void;
    status: RoomStatus;
    online: PresenceMember[];
    connected: boolean;
    reconnecting: boolean;
    presence: WhisperChannel | null;
    full: boolean;
    sessionExpired: boolean;
    serverOffset: number;
};

type RoomOptions = {
    /** False when another channel (the retro board) delivers the events. */
    subscribe: boolean;
};

export function useGameRoom(
    initial: GameSnapshot,
    options: RoomOptions,
): GameRoomHook {
    const { t } = useTrans();
    const [state, dispatch] = useReducer(
        roomReducer,
        initial,
        initialRoomState,
    );
    const [status, setStatus] = useState<RoomStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const isActive = useRef(true);
    const latestRefetch = useRef(0);
    const bufferedActions = useRef<RoomAction[] | null>(null);
    const latestState = useRef(state);
    const roomId = initial.room.id;
    const serverOffset = useServerOffset(state.snapshot.serverTime);

    latestState.current = state;

    /**
     * While a refetch is in flight, broadcast actions are held back and
     * replayed after its snapshot so events committed after the snapshot
     * was built are not wiped by it.
     */
    const apply = useCallback((action: RoomAction) => {
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

    const end = useCallback((reason: Exclude<RoomStatus, 'active'>) => {
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
            const fresh = await retroRequest<GameSnapshot>(
                GameSnapshotsController.show(roomId),
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
    }, [roomId, end, flushBufferedActions]);

    const handleEvent = useCallback(
        ({ name, payload }: GameEvent) => {
            switch (name) {
                case 'game.room.changed':
                    void refetch();
                    break;
                case 'game.room.deleted':
                    end('deleted');
                    break;
                case 'game.timer.changed':
                    apply({
                        type: 'timer.set',
                        timerEndsAt: payload.timerEndsAt as string | null,
                    });
                    break;
                case 'game.round.started':
                    apply({
                        type: 'round.started',
                        round: payload.round as GameRound,
                    });
                    break;
                case 'game.round.ended':
                    apply({
                        type: 'round.ended',
                        ended: payload as unknown as GameRoundEnded,
                    });
                    void refetch();
                    break;
                case 'game.letter.picked':
                    apply({
                        type: 'letter.picked',
                        picked: payload as unknown as GameLetterPicked,
                    });
                    break;
                case 'game.hint.revealed':
                    apply({
                        type: 'round.patched',
                        roundId: payload.roundId as string,
                        patch: { mask: payload.mask as GameMask },
                    });
                    break;
                case 'game.guess.made': {
                    const made = payload as unknown as GameGuessMade;

                    apply({
                        type: 'guess.added',
                        roundId: made.roundId,
                        guess: {
                            id: made.guessId,
                            playerId: made.playerId,
                            text: made.text,
                        },
                    });
                    break;
                }
                case 'game.drawing.op-added': {
                    const added = payload as unknown as GameDrawingOpAdded;

                    apply({
                        type: 'drawing.added',
                        roundId: added.roundId,
                        op: added.op,
                        clientOpId: added.clientOpId,
                    });
                    break;
                }
                case 'game.drawing.undone':
                    apply({
                        type: 'drawing.undone',
                        roundId: payload.roundId as string,
                    });
                    break;
                case 'game.drawing.cleared':
                    apply({
                        type: 'drawing.cleared',
                        roundId: payload.roundId as string,
                    });
                    break;
                case 'game.clue.changed':
                    apply({
                        type: 'round.patched',
                        roundId: payload.roundId as string,
                        patch: { clue: payload.clue as string[] },
                    });
                    break;
            }
        },
        [apply, refetch, end],
    );

    const onJoining = useCallback(
        (member: PresenceMember) => {
            const isKnown = latestState.current.snapshot.players.some(
                (player) => player.presenceId === member.id,
            );

            if (!isKnown) {
                void refetch();
            }
        },
        [refetch],
    );

    const { online, connected, reconnecting, presence, full } = useGameChannel(
        roomId,
        options.subscribe && status === 'active',
        {
            onEvent: handleEvent,
            onResync: refetch,
            onJoining,
        },
    );

    const handleError = useCallback(
        (error: unknown): string | null => {
            if (
                error instanceof RetroRequestError &&
                SessionExpiredStatuses.includes(error.status)
            ) {
                setSessionExpired(true);

                return null;
            }

            if (!(error instanceof RetroRequestError)) {
                return t('Something went wrong. Please try again.');
            }

            if (error.status === 0) {
                return t(
                    'The server did not respond in time. Please try again.',
                );
            }

            if (error.status === 429) {
                return t('Slow down a little.');
            }

            return (
                error.message || t('Something went wrong. Please try again.')
            );
        },
        [t],
    );

    /**
     * Every failed mutation (a round that ended meanwhile, a host change) is
     * followed by a fresh snapshot so the screen shows what the server kept.
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
        state,
        dispatch,
        apply,
        refetch,
        run,
        handleError,
        handleEvent,
        status,
        online,
        connected,
        reconnecting,
        presence,
        full,
        sessionExpired,
        serverOffset,
    };
}
