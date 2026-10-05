import type { PokerSeat, PokerStory } from '@/components/skrum/poker-table';
import { sortedTasks } from './game-reducer';
import type { PokerSnapshot, PokerTask } from './types';

export { nextUnestimatedTask } from './game-reducer';

/**
 * Who sits at the table and who watches. A vote never leaves the table: a
 * voter who went offline keeps their seat. Before the reveal the viewer's own
 * seat carries their card, which only they are sent. A spectator who voted before a
 * named reveal is shown with their card; on an anonymous round no seat links
 * a value to a player, so they stay a watcher.
 */
export function seatsFrom(
    snapshot: PokerSnapshot,
    onlineIds: ReadonlySet<string>,
): PokerSeat[] {
    const round = snapshot.current?.round ?? null;
    const votes = new Map(
        (round?.votes ?? []).map((vote) => [vote.playerId, vote]),
    );
    const showsValues =
        round !== null && round.revealedAt !== null && !round.anonymous;

    return snapshot.players.flatMap((player): PokerSeat[] => {
        const vote = votes.get(player.id);
        const isOnline = onlineIds.has(player.id);
        const user = {
            id: player.id,
            name: player.name,
            avatarUrl: player.avatarUrl,
            isMe: player.id === snapshot.me.playerId,
        };

        if (player.isSpectator && !(showsValues && vote !== undefined)) {
            return isOnline
                ? [{ user, state: 'watching', value: null, offline: false }]
                : [];
        }

        if (!isOnline && vote === undefined) {
            return [];
        }

        const isOwnHiddenVote =
            user.isMe && vote !== undefined && round?.revealedAt === null;

        return [
            {
                user,
                state: vote === undefined ? 'waiting' : 'voted',
                value: showsValues
                    ? (vote?.value ?? null)
                    : isOwnHiddenVote
                      ? round.myVote
                      : null,
                offline: !isOnline,
            },
        ];
    });
}

export function storyFrom(task: PokerTask): PokerStory {
    if (task.external === null) {
        return { title: task.title };
    }

    return {
        key: task.external.key,
        title: task.title,
        url: task.external.url,
    };
}

/** Place of a task in the queue, from 1; null when it is not in it. */
export function taskPosition(
    tasks: PokerTask[],
    taskId: string,
): number | null {
    const index = sortedTasks(tasks).findIndex((task) => task.id === taskId);

    return index === -1 ? null : index + 1;
}

const Fractions: Record<string, number> = { '½': 0.5 };

function numericEstimate(estimate: string | null): number | null {
    if (estimate === null || estimate.trim() === '') {
        return null;
    }

    const value = Fractions[estimate] ?? Number(estimate);

    return Number.isFinite(value) ? value : null;
}

/** Sum of the estimates that are numbers; null when none is, as on a T-shirt deck. */
export function estimatedPoints(tasks: PokerTask[]): number | null {
    const values = tasks
        .map((task) => numericEstimate(task.estimate))
        .filter((value): value is number => value !== null);

    return values.length === 0
        ? null
        : values.reduce((sum, value) => sum + value, 0);
}

/**
 * The deck sits at a fixed place, so a named pointer over a card would give
 * away a hidden vote: no cursor is sent or shown while a round is open, nor
 * on an ended (read-only) game.
 */
export function showsPokerCursors(snapshot: PokerSnapshot): boolean {
    return (
        snapshot.game.cursorsEnabled &&
        snapshot.game.endedAt === null &&
        (snapshot.current === null ||
            snapshot.current.round.revealedAt !== null)
    );
}

/**
 * Spec §9.6: with "Change vote after reveal", the revealed round of the
 * current task still takes a card until the task's estimate is saved.
 */
export function acceptsCardAfterReveal(snapshot: PokerSnapshot): boolean {
    const { game, current } = snapshot;

    if (!game.revoteAfterReveal || game.endedAt !== null || current === null) {
        return false;
    }

    if (current.round.revealedAt === null) {
        return false;
    }

    const task = snapshot.tasks.find(
        (candidate) => candidate.id === current.taskId,
    );

    return task !== undefined && task.estimate === null;
}

/** An observer of the team watches the game, unless they facilitate it. */
export function isObserving(
    snapshot: Pick<PokerSnapshot, 'me' | 'viewerIsObserver'>,
): boolean {
    return snapshot.viewerIsObserver && !snapshot.me.isFacilitator;
}
