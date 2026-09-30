import type { GameMask } from './types';

const Separators = [' ', '-', "'"];

/** In Draw & Guess and Decoded, every letter shown on the mask came from a hint. */
export function hintsUsed(mask: GameMask): number {
    return mask.filter(
        (character) => character !== null && !Separators.includes(character),
    ).length;
}
