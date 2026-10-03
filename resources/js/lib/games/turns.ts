import type { GameKind, GameRoomSettingsInfo } from './types';

export type TurnState = 'past' | 'current' | 'next';

/** Leader games: the host names who draws, gives the clues or tells (spec §6.1). */
export const LeaderGames: GameKind[] = ['draw', 'decoded', 'two_truths'];

/** The UI rule of Start (spec §6.1): the server does not know who is online. */
export const MinimumPlayers: Record<GameKind, number> = {
    hangman: 1,
    draw: 2,
    decoded: 2,
    gif: 1,
    two_truths: 3,
    mood: 1,
    guess_who: 3,
    quick_question: 1,
};

export function takesTurns(
    game: GameKind,
    settings: GameRoomSettingsInfo,
): boolean {
    return (
        game === 'quick_question' || (game === 'hangman' && settings.takesTurns)
    );
}

/** Hangman goes round and round; a Quick question is played once along its order. */
export function turnsWrap(game: GameKind): boolean {
    return game !== 'quick_question';
}

/** The mockup's avatar row: the turns of this lap that are over are faded, the current one ringed. */
export function turnStates(
    order: string[],
    current: string | null,
): { playerId: string; state: TurnState }[] {
    const index = current === null ? -1 : order.indexOf(current);

    return order.map((playerId, position) => {
        if (position === index) {
            return { playerId, state: 'current' };
        }

        return { playerId, state: position < index ? 'past' : 'next' };
    });
}

/** Who plays after the current player, for "Next: Inès"; null when nobody does. */
export function nextInTurn(
    order: string[],
    current: string | null,
    wraps: boolean,
): string | null {
    if (order.length === 0) {
        return null;
    }

    const index = current === null ? -1 : order.indexOf(current);

    if (index + 1 < order.length) {
        return order[index + 1];
    }

    return wraps ? order[0] : null;
}

/**
 * Two truths (owner's answer 9 B): only a player with a ready set can tell; the
 * proposal is the next ready player after the previous teller, online first.
 */
export function tellerCandidates(
    ready: string[],
    onlineOrder: string[],
): string[] {
    const online = onlineOrder.filter((playerId) => ready.includes(playerId));

    return [
        ...online,
        ...ready.filter((playerId) => !online.includes(playerId)),
    ];
}

/**
 * The body of POST rounds: the leader for leader games, the order of the
 * online players for games in turns, and for Draw & Guess its guessers (the
 * server drops the drawer from them, spec §6.15).
 */
export function startPayload(
    game: GameKind,
    settings: GameRoomSettingsInfo,
    leaderId: string | null,
    onlineOrder: string[],
): Record<string, unknown> {
    return {
        ...(LeaderGames.includes(game) ? { leader_player_id: leaderId } : {}),
        ...(takesTurns(game, settings) ? { turn_order: onlineOrder } : {}),
        ...(game === 'draw' ? { guesser_player_ids: onlineOrder } : {}),
    };
}
