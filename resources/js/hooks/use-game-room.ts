import {
    useCallback,
    useEffect,
    useReducer,
    useRef,
    type Dispatch,
} from 'react';
import GameSnapshotsController from '@/actions/App/Http/Controllers/Games/GameSnapshotsController';
import { useServerOffset } from '@/hooks/use-countdown';
import {
    useSnapshotSession,
    type SessionStatus,
} from '@/hooks/use-snapshot-session';
import { useTrans } from '@/hooks/use-trans';
import {
    initialRoomState,
    roomReducer,
    type RoomAction,
} from '@/lib/games/room-reducer';
import type {
    GameDrawingCount,
    GameDrawingOpAdded,
    GameGuessMade,
    GameLetterPicked,
    GameMask,
    GameRound,
    GameRoomState,
    GameRoundEnded,
    GameRoundRevealed,
    GameSnapshot,
    GameStatementsChanged,
    GameTurnChanged,
    GameVotesCounted,
    GameWordChanged,
    GameWordFound,
} from '@/lib/games/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import { useGameChannel, type GameEvent } from './use-game-channel';

/** A snapshot that did not arrive (lost network, server error) is asked again after this delay. */
const RefetchRetryMs = 3000;

export type GameRoomHook = {
    state: GameRoomState;
    dispatch: Dispatch<RoomAction>;
    apply: (action: RoomAction) => void;
    refetch: () => Promise<void>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    /** Entry point for game events, including those relayed by the retro board (13d). */
    handleEvent: (event: GameEvent) => void;
    status: SessionStatus;
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
    const latestState = useRef(state);
    const roomId = initial.room.id;
    const serverOffset = useServerOffset(state.snapshot.serverTime);
    const {
        apply,
        bufferedActions,
        end,
        refetch,
        run,
        handleError,
        status,
        sessionExpired,
    } = useSnapshotSession(
        dispatch,
        async () => ({
            type: 'replace' as const,
            snapshot: await retroRequest<GameSnapshot>(
                GameSnapshotsController.show(roomId),
            ),
        }),
        {
            retryTransientMs: RefetchRetryMs,
            messageFor: (error) =>
                error instanceof RetroRequestError && error.status === 429
                    ? t('Slow down a little.')
                    : undefined,
        },
    );

    latestState.current = state;

    /**
     * The viewer's own changes show at once. A patch of the round (a vote, a
     * choice, an answer) made while a refetch is in flight is replayed after
     * its snapshot too, which may have been built before the change reached
     * the server. Patches set fields, so a replay is harmless; actions that
     * append (a letter, a guess) are not replayed.
     */
    const dispatchLocal = useCallback(
        (action: RoomAction) => {
            dispatch(action);

            if (action.type === 'round.patched') {
                bufferedActions.current?.push(action);
            }
        },
        [bufferedActions],
    );

    useEffect(() => {
        if (state.resyncRequests > 0) {
            void refetch();
        }
    }, [state.resyncRequests, refetch]);

    const handleEvent = useCallback(
        ({ name, payload }: GameEvent) => {
            switch (name) {
                case 'game.undercover.changed':
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
                    if ((payload.round as GameRound).game === 'undercover') {
                        void refetch();
                    }
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
                        misses: made.misses,
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
                        count: added.count,
                    });
                    break;
                }
                case 'game.drawing.undone': {
                    const undone = payload as unknown as GameDrawingCount;

                    apply({
                        type: 'drawing.undone',
                        roundId: undone.roundId,
                        count: undone.count,
                    });
                    break;
                }
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
                case 'game.question.changed':
                    apply({
                        type: 'question.changed',
                        roundId: payload.roundId as string,
                        question: payload.question as string,
                    });
                    break;
                case 'game.answer.changed':
                    apply({
                        type: 'answer.changed',
                        roundId: payload.roundId as string,
                        playerId: payload.playerId as string,
                        answered: payload.answered as boolean,
                    });
                    break;
                case 'game.round.revealed':
                    apply({
                        type: 'round.revealed',
                        revealed: payload as unknown as GameRoundRevealed,
                    });
                    break;
                case 'game.vote.changed':
                    apply({
                        type: 'vote.changed',
                        roundId: payload.roundId as string,
                        playerId: payload.playerId as string,
                        voted: payload.voted as boolean,
                    });
                    break;
                case 'game.turn.changed':
                    apply({
                        type: 'turn.changed',
                        turn: payload as unknown as GameTurnChanged,
                    });
                    break;
                case 'game.statements.changed':
                    apply({
                        type: 'statements.changed',
                        change: payload as unknown as GameStatementsChanged,
                    });
                    break;
                case 'game.votes.counted':
                    apply({
                        type: 'votes.counted',
                        counted: payload as unknown as GameVotesCounted,
                    });
                    break;
                case 'game.word.found':
                    apply({
                        type: 'word.found',
                        found: payload as unknown as GameWordFound,
                    });
                    break;
                case 'game.word.changed':
                    apply({
                        type: 'word.changed',
                        change: payload as unknown as GameWordChanged,
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

    return {
        state,
        dispatch: dispatchLocal,
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
