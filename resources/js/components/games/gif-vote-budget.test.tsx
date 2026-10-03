import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { GifVoteBudget } from './gif-vote-budget';

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'gif',
        revealedAt: '2026-10-03T10:00:00+00:00',
        myVotes: ['a'],
        votesAllowed: 2,
        ...overrides,
    } as GameRound;
}

describe('GifVoteBudget', () => {
    it("counts the votes used out of the round's budget", () => {
        render(<GifVoteBudget round={round()} />);

        expect(
            screen.getByRole('heading', { name: 'Your votes' }),
        ).toBeTruthy();
        expect(screen.getByText('1 / 2 used')).toBeTruthy();
        expect(screen.getByText('1 vote left')).toBeTruthy();
    });

    it('is absent before the reveal and in a one-vote round', () => {
        const { container, rerender } = render(
            <GifVoteBudget round={round({ revealedAt: null })} />,
        );

        expect(container.innerHTML).toBe('');

        rerender(<GifVoteBudget round={round({ votesAllowed: 1 })} />);

        expect(container.innerHTML).toBe('');
    });
});
