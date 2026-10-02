import { useEffect, useMemo, useRef, useState } from 'react';
import { useBoard } from '@/components/retro/board-context';
import { BoardCursors } from '@/components/retro/board-cursors';
import { Spinner } from '@/components/ui/spinner';
import { useGameRoom } from '@/hooks/use-game-room';
import { useTrans } from '@/hooks/use-trans';
import type { GameSnapshot } from '@/lib/games/types';
import type { PresenceMember } from '@/lib/retro/types';
import { GameLayout } from './game-layout';
import { GameStage } from './game-stage';
import { PlayerChips } from './player-chips';
import { RoomProvider, type RoomContextValue } from './room-context';
import { useRoomPanels } from './room-panels';

const UnknownPlayerRefetchDelay = 1500;
const UnknownPlayerRefetchAttempts = 3;

/**
 * Participants already on the board get their game player on their own
 * board load, which no event announces. Online members and round leaders
 * without a player trigger a debounced refetch, retried a few times per id
 * after each refetch settles, so the leader picker and the stroke whispers
 * see them.
 */
function useUnknownPlayerRefetch(
    snapshot: GameSnapshot,
    online: PresenceMember[],
    refetch: () => Promise<void>,
): void {
    const attempts = useRef(new Map<string, number>());
    const [settledRefetches, setSettledRefetches] = useState(0);
    const presenceIds = new Set(
        snapshot.players.map((player) => player.presenceId),
    );
    const playerIds = new Set(snapshot.players.map((player) => player.id));
    const leaderId = snapshot.round?.leaderPlayerId ?? null;
    const unknownIds = online
        .map((member) => member.id)
        .filter((id) => !presenceIds.has(id));

    if (leaderId !== null && !playerIds.has(leaderId)) {
        unknownIds.push(`leader:${leaderId}`);
    }

    const unknownKey = unknownIds.sort().join(',');

    useEffect(() => {
        if (unknownKey === '') {
            return;
        }

        const timer = window.setTimeout(() => {
            const retried = unknownKey
                .split(',')
                .filter(
                    (id) =>
                        (attempts.current.get(id) ?? 0) <
                        UnknownPlayerRefetchAttempts,
                );

            if (retried.length === 0) {
                return;
            }

            for (const id of retried) {
                attempts.current.set(id, (attempts.current.get(id) ?? 0) + 1);
            }

            void refetch().finally(() =>
                setSettledRefetches((count) => count + 1),
            );
        }, UnknownPlayerRefetchDelay);

        return () => window.clearTimeout(timer);
    }, [unknownKey, settledRefetches, refetch]);
}

/**
 * The board's copy of the game only seeds the room on mount (the component
 * is keyed by room id). A later board snapshot may predate game events the
 * room already applied, so it asks for the room's own buffered refetch,
 * which is sequenced with those events, instead of replacing the state.
 */
function useBoardSnapshotRefetch(
    snapshot: GameSnapshot,
    refetch: () => Promise<void>,
): void {
    const seeded = useRef(snapshot);

    useEffect(() => {
        if (snapshot === seeded.current) {
            return;
        }

        seeded.current = snapshot;
        void refetch();
    }, [snapshot, refetch]);
}

/** The board timer is the icebreaker's game timer (spec §5). */
function withBoardTimer(
    snapshot: GameSnapshot,
    timerEndsAt: string | null,
): GameSnapshot {
    if (snapshot.room.timerEndsAt === timerEndsAt) {
        return snapshot;
    }

    return { ...snapshot, room: { ...snapshot.room, timerEndsAt } };
}

/**
 * The retro's presence channel carries the game: its members are
 * participants, which are the icebreaker players' presence ids, so live
 * strokes and cursors share one channel (spec §6).
 *
 * The stage is the layout of a game room without its header: the session
 * header, the timer and the reaction bar are the board's. The facilitator
 * chooses the game on the cards; the players see them beside the stage.
 */
function IcebreakerGame({ snapshot }: { snapshot: GameSnapshot }) {
    const board = useBoard();
    const { t } = useTrans();
    const room = useGameRoom(snapshot, { subscribe: false });
    const { subscribeGameEvents } = board;
    const { handleEvent, refetch } = room;
    const timerEndsAt = board.board.retro.timerEndsAt;

    useUnknownPlayerRefetch(room.state.snapshot, board.online, refetch);

    useEffect(
        () => subscribeGameEvents(handleEvent),
        [subscribeGameEvents, handleEvent],
    );

    useBoardSnapshotRefetch(snapshot, refetch);

    const gameSnapshot = useMemo(
        () => withBoardTimer(room.state.snapshot, timerEndsAt),
        [room.state.snapshot, timerEndsAt],
    );
    const panels = useRoomPanels({
        snapshot: gameSnapshot,
        lastEnded: room.state.lastEnded,
        watchChoice: true,
    });

    const ctx: RoomContextValue = {
        snapshot: gameSnapshot,
        lastEnded: room.state.lastEnded,
        dispatch: room.dispatch,
        apply: room.apply,
        run: room.run,
        handleError: room.handleError,
        refetch: room.refetch,
        online: board.online,
        presence: board.presence,
        serverOffset: room.serverOffset,
        sessionExpired: board.sessionExpired || room.sessionExpired,
    };

    return (
        <RoomProvider value={ctx}>
            <section
                aria-label={t('Icebreaker game')}
                className="flex min-h-0 flex-1 flex-col"
            >
                <GameLayout
                    {...panels}
                    stage={<GameStage />}
                    summary={<PlayerChips />}
                    summaryFor="players"
                    className="h-auto flex-1 border-t"
                />
            </section>
        </RoomProvider>
    );
}

/**
 * The board area during the Icebreaker phase: the game instead of columns.
 * It takes the height the board has left, so that the columns of the game
 * scroll on their own and a drawing fits the stage.
 */
export function IcebreakerStage({ hideMyCursor }: { hideMyCursor: boolean }) {
    const { board } = useBoard();
    const [element, setElement] = useState<HTMLElement | null>(null);

    if (board.icebreaker === null) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <Spinner />
            </div>
        );
    }

    return (
        <div
            ref={setElement}
            data-slot="icebreaker-stage"
            className="relative flex min-h-0 flex-1 flex-col"
        >
            <IcebreakerGame
                key={board.icebreaker.room.id}
                snapshot={board.icebreaker}
            />
            <BoardCursors container={element} hidden={hideMyCursor} />
        </div>
    );
}
