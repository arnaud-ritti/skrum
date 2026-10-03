import { describe, expect, it } from 'vitest';
import { canVoteFor, isWinningAnswer, rankedAnswers } from './gif';
import type { GameGifRevealed, GameRound } from './types';

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'gif',
        revealedAt: '2026-10-03T10:00:00+00:00',
        myVotes: [],
        votesAllowed: 2,
        ...overrides,
    } as GameRound;
}

function answer(
    id: string,
    rank: number | null,
    votes: number | null = null,
): GameGifRevealed {
    return {
        id,
        playerId: null,
        votes,
        rank,
        gif: { id, previewUrl: `/gifs/${id}`, url: `/gifs/${id}` },
    };
}

describe('canVoteFor', () => {
    it('never lets a player vote for their own GIF', () => {
        expect(canVoteFor(round(), 'mine', 'mine')).toBe(false);
    });

    it('lets a player vote while the budget lasts', () => {
        expect(canVoteFor(round({ myVotes: ['a'] }), 'b', 'mine')).toBe(true);
    });

    it('refuses a new vote once the budget is used, but not taking one back', () => {
        const spent = round({ myVotes: ['a', 'b'] });

        expect(canVoteFor(spent, 'c', 'mine')).toBe(false);
        expect(canVoteFor(spent, 'a', 'mine')).toBe(true);
    });

    it('lets a one-vote round move its vote to any other GIF', () => {
        const single = round({ votesAllowed: 1, myVotes: ['a'] });

        expect(canVoteFor(single, 'b', 'mine')).toBe(true);
        expect(canVoteFor(single, 'mine', 'mine')).toBe(false);
    });

    it('lets a player without an answer vote for any GIF', () => {
        expect(canVoteFor(round(), 'a', null)).toBe(true);
    });
});

describe('rankedAnswers', () => {
    it('orders by rank, ties by id, unranked GIFs last', () => {
        const ranked = rankedAnswers([
            answer('d', null),
            answer('c', 3, 1),
            answer('b', 1, 4),
            answer('a', 1, 4),
        ]);

        expect(ranked.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('leaves the list it was given untouched', () => {
        const answers = [answer('b', 2, 1), answer('a', 1, 2)];

        rankedAnswers(answers);

        expect(answers.map((item) => item.id)).toEqual(['b', 'a']);
    });
});

describe('isWinningAnswer', () => {
    it('crowns every GIF of rank one with at least one vote', () => {
        expect(isWinningAnswer(answer('a', 1, 2))).toBe(true);
        expect(isWinningAnswer(answer('b', 2, 1))).toBe(false);
    });

    it('crowns nobody when the top has no vote, or without ranks', () => {
        expect(isWinningAnswer(answer('a', 1, 0))).toBe(false);
        expect(isWinningAnswer(answer('a', null, null))).toBe(false);
    });
});
