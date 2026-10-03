import { describe, expect, it } from 'vitest';
import { decodedPuzzles } from './decoded';
import type { GameHistoryRound, GameKind, GameRound } from './types';

function current(
    number: number | null,
    roundsTotal: number | null,
    game: GameKind = 'decoded',
): GameRound {
    return { id: 'now', game, number, roundsTotal } as GameRound;
}

function ended(
    number: number | null,
    overrides: Partial<GameHistoryRound> = {},
): GameHistoryRound {
    return {
        id: `round-${number}`,
        game: 'decoded',
        outcome: 'guessed',
        word: `word ${number}`,
        question: null,
        leaderPlayerId: 'ada',
        leaderName: 'Ada',
        winnerPlayerId: 'bob',
        winnerName: 'Bob',
        endedAt: '2026-10-03T10:00:00Z',
        number,
        roundsTotal: 8,
        clue: ['🦁', '👑'],
        ...overrides,
    };
}

describe('decodedPuzzles', () => {
    it('lists the done puzzles oldest first, the current one and the coming ones', () => {
        const puzzles = decodedPuzzles(
            [ended(3), ended(2), ended(1)],
            current(4, 8),
        );

        expect(puzzles.map((puzzle) => [puzzle.state, puzzle.number])).toEqual([
            ['done', 1],
            ['done', 2],
            ['done', 3],
            ['current', 4],
            ['next', 5],
            ['next', 6],
            ['next', 7],
            ['next', 8],
        ]);
        expect(puzzles[0]).toEqual({
            state: 'done',
            number: 1,
            clue: ['🦁', '👑'],
            word: 'word 1',
            finderName: 'Bob',
        });
    });

    it('stops at a round of another game in the history', () => {
        const puzzles = decodedPuzzles(
            [ended(3), ended(2, { game: 'hangman' }), ended(1)],
            current(4, 8),
        );

        expect(
            puzzles
                .filter((puzzle) => puzzle.state === 'done')
                .map((puzzle) => puzzle.number),
        ).toEqual([3]);
    });

    it('has no coming puzzle in an endless game', () => {
        const puzzles = decodedPuzzles([ended(1)], current(2, null));

        expect(puzzles.map((puzzle) => puzzle.state)).toEqual([
            'done',
            'current',
        ]);
    });

    it('lists nothing for a round without a number', () => {
        expect(decodedPuzzles([ended(1)], current(null, null))).toEqual([]);
    });

    it('lists nothing for another game or without a round', () => {
        expect(decodedPuzzles([], current(2, 8, 'hangman'))).toEqual([]);
        expect(decodedPuzzles([ended(1)], null)).toEqual([]);
    });

    it('names no finder for a puzzle nobody found', () => {
        const [puzzle] = decodedPuzzles(
            [ended(1, { outcome: 'timed_out', winnerName: null, clue: null })],
            current(2, 3),
        );

        expect(puzzle).toEqual({
            state: 'done',
            number: 1,
            clue: [],
            word: 'word 1',
            finderName: null,
        });
    });
});
