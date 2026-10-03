import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { DrawFoundBy } from './draw-found-by';
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

function renderFoundBy(round: Partial<GameRound>, isLeader = false) {
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'draw' },
            me: { playerId: isLeader ? 'bob' : 'cy' },
            players: [
                player('ines', 'Inès'),
                player('malik', 'Malik'),
                player('bob', 'Bob'),
            ],
        },
    } as unknown as RoomContextValue;

    return renderWithProviders(
        <RoomProvider value={ctx}>
            <DrawFoundBy
                round={
                    {
                        id: 'round',
                        game: 'draw',
                        leaderPlayerId: 'bob',
                        guessersTotal: 5,
                        pointsPerFinder: 5,
                        finders: [],
                        ...round,
                    } as GameRound
                }
                isLeader={isLeader}
            />
        </RoomProvider>,
    );
}

const finders = [
    { playerId: 'ines', seconds: 18, points: 10 },
    { playerId: 'malik', seconds: 31, points: 8 },
];

describe('DrawFoundBy', () => {
    it('shows nothing while nobody found', () => {
        renderFoundBy({});

        expect(
            document.querySelector('[data-slot="draw-found-by"]'),
        ).toBeNull();
    });

    it('shows nothing for a round started without its guessers', () => {
        renderFoundBy({ guessersTotal: null, finders });

        expect(
            document.querySelector('[data-slot="draw-found-by"]'),
        ).toBeNull();
    });

    it('lists each finder with their time and points, out of the guessers', () => {
        renderFoundBy({ finders });

        const block = within(
            document.querySelector(
                '[data-slot="draw-found-by"]',
            ) as HTMLElement,
        );

        expect(block.getByText('Found by · 2 / 5')).toBeTruthy();
        expect(
            block
                .getAllByRole('listitem')
                .map((row) => row.textContent?.replace(/\s+/g, ' ')),
        ).toEqual(['IInès0:18+10', 'MMalik0:31+8']);
        expect(screen.queryByText(/per finder/)).toBeNull();
    });

    it('tells the drawer what each finder earns them', () => {
        renderFoundBy({ finders }, true);

        expect(screen.getByText('You earn +5 per finder')).toBeTruthy();
    });
});
