import type { GameMask } from './types';

const Separators = [' ', '-', "'"];

/** In Draw & Guess and Decoded, every letter shown on the mask came from a hint. */
export function hintsUsed(mask: GameMask): number {
    return mask.filter(
        (character) => character !== null && !Separators.includes(character),
    ).length;
}

/** When the server reveals its next letter on its own (spec §6.5), or null when it will not. */
export function nextAutoHintAt(
    startedAt: string,
    hintSeconds: number | null,
    revealed: number,
    maxHints: number,
): number | null {
    if (hintSeconds === null || revealed >= maxHints) {
        return null;
    }

    return Date.parse(startedAt) + (revealed + 1) * hintSeconds * 1000;
}
