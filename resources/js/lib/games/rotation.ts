import type { GamePlayer } from './types';

/**
 * Spec §4.1 "endless rotation": the next online player after the previous
 * leader in join order, wrapping around; the first online player otherwise.
 */
export function nextLeaderId(
    players: GamePlayer[],
    onlinePresenceIds: Set<string>,
    previousLeaderId: string | null,
): string | null {
    const count = players.length;
    const start = players.findIndex((player) => player.id === previousLeaderId);

    for (let offset = 1; offset <= count; offset++) {
        const player = players[(start + offset + count) % count];

        if (onlinePresenceIds.has(player.presenceId)) {
            return player.id;
        }
    }

    return null;
}
