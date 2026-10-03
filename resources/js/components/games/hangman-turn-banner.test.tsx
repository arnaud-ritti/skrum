import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { HangmanTurnBanner } from './hangman-turn-banner';
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

function renderBanner(round: Partial<GameRound>) {
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'hangman' },
            me: { playerId: 'ada' },
            players: [player('ada', 'Arnaud'), player('ines', 'Inès')],
        },
    } as unknown as RoomContextValue;

    return renderWithProviders(
        <RoomProvider value={ctx}>
            <HangmanTurnBanner
                round={
                    {
                        id: 'round',
                        game: 'hangman',
                        turnOrder: [],
                        turnPlayerId: null,
                        ...round,
                    } as unknown as GameRound
                }
            />
        </RoomProvider>,
    );
}

describe('HangmanTurnBanner', () => {
    it('tells the viewer it is their turn', () => {
        renderBanner({ turnOrder: ['ada', 'ines'], turnPlayerId: 'ada' });

        const banner = document.querySelector(
            '[data-slot="hangman-turn-banner"]',
        );

        expect(banner?.textContent).toContain(
            'Your turn, Arnaud — pick a letter',
        );
        expect(banner?.getAttribute('data-mine')).toBe('true');
        expect(screen.getByRole('status').textContent).toBe(
            'Your turn, Arnaud — pick a letter',
        );
    });

    it('names whose turn it is to the others', () => {
        renderBanner({ turnOrder: ['ada', 'ines'], turnPlayerId: 'ines' });

        const banner = document.querySelector(
            '[data-slot="hangman-turn-banner"]',
        );

        expect(banner?.textContent).toContain("Inès's turn");
        expect(banner?.getAttribute('data-mine')).toBe('false');
        expect(banner?.hasAttribute('role')).toBe(false);
        expect(screen.getByRole('status').textContent).toBe('');
    });

    it('is absent from a round without turns', () => {
        renderBanner({});

        expect(
            document.querySelector('[data-slot="hangman-turn-banner"]'),
        ).toBeNull();
    });
});
