import { useCallback, useReducer, useRef, type Dispatch } from 'react';
import PokerSnapshotsController from '@/actions/App/Http/Controllers/Poker/PokerSnapshotsController';
import { useServerOffset } from '@/hooks/use-countdown';
import {
    useSnapshotSession,
    type SessionStatus,
} from '@/hooks/use-snapshot-session';
import { gameReducer, type GameAction } from '@/lib/poker/game-reducer';
import type { PokerSnapshot, PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { usePokerChannel, type PokerEvent } from './use-poker-channel';

type PokerGameState = {
    snapshot: PokerSnapshot;
    dispatch: Dispatch<GameAction>;
    apply: (action: GameAction) => void;
    refetch: () => Promise<void>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    status: SessionStatus;
    online: PresenceMember[];
    connected: boolean;
    reconnecting: boolean;
    presence: WhisperChannel | null;
    sessionExpired: boolean;
    serverOffset: number;
};

type GameOptions = { onLeaving?: (member: PresenceMember) => void };

export function usePokerGame(
    initial: PokerSnapshot,
    options: GameOptions = {},
): PokerGameState {
    const [snapshot, dispatch] = useReducer(gameReducer, initial);
    const latestSnapshot = useRef(snapshot);
    const gameId = initial.game.id;
    const serverOffset = useServerOffset(snapshot.serverTime);
    const { apply, end, refetch, run, handleError, status, sessionExpired } =
        useSnapshotSession(dispatch, async () => ({
            type: 'replace' as const,
            snapshot: await retroRequest<PokerSnapshot>(
                PokerSnapshotsController.show(gameId),
            ),
        }));

    const onLeaving = useRef(options.onLeaving);

    latestSnapshot.current = snapshot;
    onLeaving.current = options.onLeaving;

    const onEvent = useCallback(
        ({ name, payload }: PokerEvent) => {
            switch (name) {
                case 'task.saved': {
                    const task = payload.task as PokerTask;

                    if (
                        task.external !== null &&
                        !latestSnapshot.current.me.isGuest
                    ) {
                        void refetch();
                        break;
                    }

                    apply({ type: 'task.upsert', task });
                    break;
                }
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
                case 'timer.changed':
                    apply({
                        type: 'timer.set',
                        roundId: payload.roundId as string,
                        timerEndsAt: payload.timerEndsAt as string | null,
                    });
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
        {
            onEvent,
            onResync: refetch,
            onJoining,
            onLeaving: (member) => onLeaving.current?.(member),
        },
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
