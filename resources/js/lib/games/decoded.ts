import type { GameHistoryRound, GameRound } from './types';

export type DecodedPuzzle =
    | {
          state: 'done';
          number: number;
          clue: string[];
          word: string | null;
          finderName: string | null;
      }
    | { state: 'current'; number: number }
    | { state: 'next'; number: number };

/**
 * Spec §6.16: the puzzles of the Decoded game in progress. The history is
 * newest first; the run is the unbroken chain of numbered Decoded rounds
 * just before the current one.
 */
export function decodedPuzzles(
    history: GameHistoryRound[],
    round: GameRound | null,
): DecodedPuzzle[] {
    if (
        round === null ||
        round.game !== 'decoded' ||
        round.number === null ||
        round.number === undefined
    ) {
        return [];
    }

    const done: DecodedPuzzle[] = [];
    let expected = round.number - 1;

    for (const entry of history) {
        if (
            expected < 1 ||
            entry.game !== 'decoded' ||
            entry.number !== expected
        ) {
            break;
        }

        done.unshift({
            state: 'done',
            number: expected,
            clue: entry.clue ?? [],
            word: entry.word,
            finderName: entry.winnerName,
        });
        expected -= 1;
    }

    const coming: DecodedPuzzle[] = [];
    const roundsTotal = round.roundsTotal ?? null;

    for (
        let number = round.number + 1;
        roundsTotal !== null && number <= roundsTotal;
        number++
    ) {
        coming.push({ state: 'next', number });
    }

    return [...done, { state: 'current', number: round.number }, ...coming];
}
