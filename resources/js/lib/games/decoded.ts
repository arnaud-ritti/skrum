import type { GameHistoryRound, GameKind, GameRound } from './types';

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

export type DecodedRun = {
    puzzles: DecodedPuzzle[];
    /** The number of the current puzzle, or of the last one played between two rounds. */
    played: number;
    /** The number of the game's last puzzle; null in an endless game. */
    total: number | null;
};

type DecodedRoom = {
    game: GameKind;
    settings: { roundsPerGame: number | null };
};

/**
 * Spec §6.16: the puzzles of the Decoded game in progress, during a round
 * and between two rounds of the same game. The history is newest first; the
 * run is the unbroken chain of numbered Decoded rounds. The coming slots
 * follow `NumberGameRound`: the game goes on while the last number stays
 * under the previous round's total, up to the room's number of rounds.
 */
export function decodedPuzzles(
    history: GameHistoryRound[],
    round: GameRound | null,
    room: DecodedRoom,
): DecodedRun | null {
    if (round !== null) {
        if (
            round.game !== 'decoded' ||
            round.number === null ||
            round.number === undefined
        ) {
            return null;
        }

        const roomTotal = room.settings.roundsPerGame;

        const isLast =
            (round.roundsTotal !== null &&
                round.roundsTotal !== undefined &&
                round.number >= round.roundsTotal) ||
            (roomTotal !== null && round.number >= roomTotal);
        const total = isLast ? round.number : roomTotal;

        return {
            puzzles: [
                ...donePuzzles(history, round.number - 1),
                { state: 'current', number: round.number },
                ...comingPuzzles(round.number, total),
            ],
            played: round.number,
            total,
        };
    }

    const [last] = history;

    if (
        last === undefined ||
        room.game !== 'decoded' ||
        last.game !== 'decoded' ||
        last.number === null ||
        last.number === undefined
    ) {
        return null;
    }

    if (
        last.roundsTotal !== null &&
        last.roundsTotal !== undefined &&
        last.number >= last.roundsTotal
    ) {
        return null;
    }

    const roomTotal = room.settings.roundsPerGame;

    if (roomTotal !== null && last.number >= roomTotal) {
        return null;
    }

    return {
        puzzles: [
            ...donePuzzles(history, last.number),
            ...comingPuzzles(last.number, roomTotal),
        ],
        played: last.number,
        total: roomTotal,
    };
}

function donePuzzles(
    history: GameHistoryRound[],
    newest: number,
): DecodedPuzzle[] {
    const done: DecodedPuzzle[] = [];
    let expected = newest;

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

    return done;
}

function comingPuzzles(after: number, total: number | null): DecodedPuzzle[] {
    const coming: DecodedPuzzle[] = [];

    for (let number = after + 1; total !== null && number <= total; number++) {
        coming.push({ state: 'next', number });
    }

    return coming;
}
