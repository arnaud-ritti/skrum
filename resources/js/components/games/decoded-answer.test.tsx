import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { DecodedAnswer } from './decoded-answer';
import { RoomProvider, type RoomContextValue } from './room-context';

function player(id: string, name: string) {
    return {
        id,
        presenceId: `presence-${id}`,
        name,
        avatarUrl: null,
        isGuest: false,
    };
}

function renderAnswer(me: string, viewerIsObserver = false) {
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'decoded' },
            me: { playerId: me },
            players: [
                player('leader', 'Lea'),
                player('ines', 'Inès'),
                player('cy', 'Cy'),
            ],
            viewerIsObserver,
        },
        dispatch: vi.fn(),
        refetch: vi.fn(),
        run: <T,>(mutation: Promise<T>) => mutation,
    } as unknown as RoomContextValue;
    const round = {
        id: 'round',
        game: 'decoded',
        leaderPlayerId: 'leader',
        guesses: [
            { id: 'g1', playerId: 'cy', text: 'ice age' },
            { id: 'g2', playerId: 'ines', text: 'cold' },
            {
                id: 'g3',
                playerId: 'cy',
                text: 'crack the ice',
                veryClose: true,
            },
        ],
    } as GameRound;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <DecodedAnswer round={round} />
        </RoomProvider>,
    );
}

describe('DecodedAnswer', () => {
    it('gives a guesser the answer field and only their own attempts, the close one marked', () => {
        renderAnswer('cy');

        const attempts = within(
            screen.getByRole('list', { name: 'Your attempts · 2' }),
        ).getAllByRole('listitem');

        expect(
            screen.getByRole('textbox', { name: 'Your guess' }),
        ).toBeTruthy();
        expect(attempts.map((attempt) => attempt.textContent)).toEqual([
            'ice age',
            'crack the ice · almost',
        ]);
        expect(attempts[0].getAttribute('data-close')).toBeNull();
        expect(attempts[1].getAttribute('data-close')).toBe('true');
        expect(screen.queryByText('cold')).toBeNull();
    });

    it('shows the clue giver every attempt with its author, without a field', () => {
        renderAnswer('leader');

        const attempts = within(
            screen.getByRole('list', { name: 'Attempts · 3' }),
        ).getAllByRole('listitem');

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(
            screen.getByText('You know the word, so you cannot guess.'),
        ).toBeTruthy();
        expect(attempts.map((attempt) => attempt.textContent)).toEqual([
            'Cy · ice age',
            'Inès · cold',
            'Cy · crack the ice',
        ]);
    });

    it('shows an observer every attempt without a field or a note', () => {
        renderAnswer('watcher', true);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(
            screen.queryByText('You know the word, so you cannot guess.'),
        ).toBeNull();
        expect(screen.getByRole('list', { name: 'Attempts · 3' })).toBeTruthy();
    });
});
