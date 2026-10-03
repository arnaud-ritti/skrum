import { describe, expect, it } from 'vitest';
import { decodedPuzzles, type DecodedPuzzle } from './decoded';
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

function room(
    roundsPerGame: number | null,
    game: GameKind = 'decoded',
): { game: GameKind; settings: { roundsPerGame: number | null } } {
    return { game, settings: { roundsPerGame } };
}

function states(puzzles: DecodedPuzzle[] | undefined): [string, number][] {
    return (puzzles ?? []).map((puzzle) => [puzzle.state, puzzle.number]);
}

describe('decodedPuzzles', () => {
    it('lists the done puzzles oldest first, the current one and the coming ones', () => {
        const run = decodedPuzzles(
            [ended(3), ended(2), ended(1)],
            current(4, 8),
            room(8),
        );

        expect(states(run?.puzzles)).toEqual([
            ['done', 1],
            ['done', 2],
            ['done', 3],
            ['current', 4],
            ['next', 5],
            ['next', 6],
            ['next', 7],
            ['next', 8],
        ]);
        expect(run?.played).toBe(4);
        expect(run?.total).toBe(8);
        expect(run?.puzzles[0]).toEqual({
            state: 'done',
            number: 1,
            clue: ['🦁', '👑'],
            word: 'word 1',
            finderName: 'Bob',
        });
    });

    it('stops at a round of another game in the history', () => {
        const run = decodedPuzzles(
            [ended(3), ended(2, { game: 'hangman' }), ended(1)],
            current(4, 8),
            room(8),
        );

        expect(
            run?.puzzles
                .filter((puzzle) => puzzle.state === 'done')
                .map((puzzle) => puzzle.number),
        ).toEqual([3]);
    });

    it('has no coming puzzle in an endless game', () => {
        const run = decodedPuzzles([ended(1)], current(2, null), room(null));

        expect(run?.puzzles.map((puzzle) => puzzle.state)).toEqual([
            'done',
            'current',
        ]);
        expect(run?.total).toBeNull();
    });

    it('ends the list at the current puzzle when the room was set to fewer rounds', () => {
        const run = decodedPuzzles(
            [ended(3), ended(2), ended(1)],
            current(4, 8),
            room(3),
        );

        expect(states(run?.puzzles).at(-1)).toEqual(['current', 4]);
        expect(run?.total).toBe(4);
    });

    it('lists nothing for a round without a number', () => {
        expect(
            decodedPuzzles([ended(1)], current(null, null), room(null)),
        ).toBeNull();
    });

    it('lists nothing for another game or without a round of Decoded', () => {
        expect(
            decodedPuzzles([], current(2, 8, 'hangman'), room(8, 'hangman')),
        ).toBeNull();
        expect(decodedPuzzles([], null, room(8))).toBeNull();
        expect(
            decodedPuzzles([ended(1, { game: 'hangman' })], null, room(8)),
        ).toBeNull();
    });

    it('still lists 3 done and 5 coming puzzles when round 3 of 8 just ended', () => {
        const run = decodedPuzzles(
            [ended(3), ended(2), ended(1)],
            null,
            room(8),
        );

        expect(states(run?.puzzles)).toEqual([
            ['done', 1],
            ['done', 2],
            ['done', 3],
            ['next', 4],
            ['next', 5],
            ['next', 6],
            ['next', 7],
            ['next', 8],
        ]);
        expect(run?.played).toBe(3);
        expect(run?.total).toBe(8);
    });

    it('keeps the done puzzles of an endless game between two rounds', () => {
        const run = decodedPuzzles(
            [ended(2, { roundsTotal: null }), ended(1, { roundsTotal: null })],
            null,
            room(null),
        );

        expect(states(run?.puzzles)).toEqual([
            ['done', 1],
            ['done', 2],
        ]);
    });

    it('lists nothing between rounds once the game is over', () => {
        expect(decodedPuzzles([ended(8), ended(7)], null, room(8))).toBeNull();
        expect(decodedPuzzles([ended(3)], null, room(3))).toBeNull();
    });

    it('lists nothing between rounds once the room switched to another game', () => {
        expect(decodedPuzzles([ended(3)], null, room(8, 'hangman'))).toBeNull();
    });

    it('names no finder for a puzzle nobody found', () => {
        const run = decodedPuzzles(
            [ended(1, { outcome: 'timed_out', winnerName: null, clue: null })],
            current(2, 3),
            room(3),
        );

        expect(run?.puzzles[0]).toEqual({
            state: 'done',
            number: 1,
            clue: [],
            word: 'word 1',
            finderName: null,
        });
    });
});
