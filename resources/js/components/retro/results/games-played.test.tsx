import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GamesPlayedRound } from '@/lib/retro/types';
import { boardContext, renderInBoard } from '@/test/retro-board';
import { GamesPlayed } from './games-played';

function round(overrides: Partial<GamesPlayedRound>): GamesPlayedRound {
    return {
        id: 'round-1',
        game: 'hangman',
        outcome: 'solved',
        word: null,
        question: null,
        clue: null,
        leader: null,
        winner: null,
        answers: null,
        endedAt: '2026-10-03T10:00:00+00:00',
        ...overrides,
    };
}

function renderRounds(rounds: GamesPlayedRound[]) {
    renderInBoard(
        <GamesPlayed
            games={{
                roomId: 'room',
                rounds,
                leaderboard: [],
                roundsPlayed: rounds.length,
            }}
        />,
        boardContext(),
    );

    return screen.getAllByRole('listitem');
}

describe('GamesPlayed', () => {
    it('names a Mood weather round with its outcome and icon', () => {
        const [row] = renderRounds([
            round({ game: 'mood', outcome: 'revealed' }),
        ]);

        expect(within(row).getByText('Mood weather')).toBeTruthy();
        expect(within(row).getByText('Revealed')).toBeTruthy();
        expect(row.querySelector('svg.lucide-cloud-sun')).not.toBeNull();
    });

    it('counts one round played in the singular', () => {
        renderRounds([round({})]);

        expect(screen.getByText('1 round played')).toBeTruthy();
    });

    it('counts several rounds played in the plural', () => {
        renderRounds([round({}), round({ id: 'round-2' })]);

        expect(screen.getByText('2 rounds played')).toBeTruthy();
    });

    it('counts the statements of a Two truths round', () => {
        const [row] = renderRounds([
            round({ game: 'two_truths', outcome: 'revealed' }),
        ]);

        expect(within(row).getByText('3 statements')).toBeTruthy();
    });

    it('shows the question of a Quick question round, and who has spoken', () => {
        const [row] = renderRounds([
            round({
                game: 'quick_question',
                outcome: 'finished',
                question: 'Your best holiday?',
            }),
        ]);

        expect(within(row).getByText('Your best holiday?')).toBeTruthy();
        expect(within(row).getByText('Everyone has spoken')).toBeTruthy();
    });
});
