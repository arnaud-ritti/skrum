import type { GameMask } from './types';

const Separators = [' ', '-', "'"];

/** In Draw & Guess and Decoded, every letter shown on the mask came from a hint. */
export function hintsUsed(mask: GameMask): number {
    return mask.filter(
        (character) => character !== null && !Separators.includes(character),
    ).length;
}

/**
 * When the server reveals its next letter on its own (spec §6.5), or null when it will not.
 * The n-th job runs at startedAt + n·hintSeconds and shows a letter while fewer than n are shown.
 * "New word" (spec §6.15) starts the letters again from none while the jobs keep their times,
 * so the next letter then comes with the first slot still ahead, up to the first word's slots.
 */
export function nextAutoHintAt(
    startedAt: string,
    hintSeconds: number | null,
    revealed: number,
    maxHints: number,
    afterWordChange?: { hintSlots: number; now: number },
): number | null {
    if (hintSeconds === null || revealed >= maxHints) {
        return null;
    }

    const started = Date.parse(startedAt);
    const interval = hintSeconds * 1000;

    if (afterWordChange === undefined) {
        return started + (revealed + 1) * interval;
    }

    const slot = Math.max(
        revealed + 1,
        Math.floor((afterWordChange.now - started) / interval) + 1,
    );

    if (slot > afterWordChange.hintSlots) {
        return null;
    }

    return started + slot * interval;
}
