import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameRoundEnded, GameSnapshot } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { DecodedLeaderboard } from './decoded-leaderboard';
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

function renderBoard(
    snapshot: Partial<GameSnapshot>,
    lastEnded: GameRoundEnded | null = null,
    canManage = false,
) {
    const ctx = {
        snapshot: {
            room: {
                id: 'r1',
                game: 'decoded',
                hostPlayerId: 'leader',
                canManage,
                isIcebreaker: false,
                settings: { roundsPerGame: 8 },
            },
            me: { playerId: 'cy' },
            players: [
                player('leader', 'Lea'),
                player('ines', 'Inès'),
                player('cy', 'Cy'),
            ],
            history: [],
            round: null,
            leaderboard: [
                { playerId: 'ines', points: 30, wins: 3, roundsPlayed: 3 },
                { playerId: 'cy', points: 15, wins: 1, roundsPlayed: 3 },
            ],
            ...snapshot,
        },
        lastEnded,
        online: [{ id: 'presence-leader' }, { id: 'presence-cy' }],
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <DecodedLeaderboard />
        </RoomProvider>,
    );
}

const liveRound = {
    id: 'round',
    game: 'decoded',
    leaderPlayerId: 'leader',
    number: 4,
    roundsTotal: 8,
    guesses: [],
} as unknown as GameSnapshot['round'];

describe('DecodedLeaderboard', () => {
    it('ranks the round in play, everyone still at zero, then the totals as bars', () => {
        renderBoard({ round: liveRound });

        const round = screen.getByRole('region', { name: 'Round leaderboard' });
        const rows = within(round).getAllByRole('listitem');
        const totals = screen.getByRole('region', {
            name: 'Total after 3 rounds',
        });

        expect(within(round).getByText('Puzzle 4')).toBeTruthy();
        expect(rows).toHaveLength(3);
        expect(within(rows[0]).getByText('giving clues')).toBeTruthy();
        expect(within(rows[1]).getByText('guessing…')).toBeTruthy();
        expect(
            rows.map(
                (row) =>
                    row.querySelector('[data-slot="round-delta"]')?.textContent,
            ),
        ).toEqual(['0', '0', '0']);
        expect(
            within(totals)
                .getAllByRole('progressbar')
                .map((bar) => bar.getAttribute('aria-label')),
        ).toEqual(['Inès', 'Cy']);
        expect(within(totals).getByText('30')).toBeTruthy();
    });

    it('crowns the finder of the round that just ended with the points it earned', () => {
        renderBoard({ round: null }, {
            roundId: 'round',
            outcome: 'guessed',
            word: 'ice',
            winnerPlayerId: 'ines',
            leaderPlayerId: 'leader',
            points: [
                { playerId: 'ines', points: 10, isWin: true },
                { playerId: 'leader', points: 5, isWin: false },
            ],
        } as GameRoundEnded);

        const rows = within(
            screen.getByRole('region', { name: 'Round leaderboard' }),
        ).getAllByRole('listitem');

        expect(rows[0].textContent).toContain('Inès');
        expect(rows[0].querySelector('svg.lucide-crown')).not.toBeNull();
        expect(
            rows.map(
                (row) =>
                    row.querySelector('[data-slot="round-delta"]')?.textContent,
            ),
        ).toEqual(['+10', '+5', '0']);
    });

    it('offers who manages the room to reset the scores', () => {
        renderBoard({ round: liveRound }, null, true);

        expect(
            screen.getByRole('button', { name: 'Reset scores' }),
        ).toBeTruthy();
    });
});
