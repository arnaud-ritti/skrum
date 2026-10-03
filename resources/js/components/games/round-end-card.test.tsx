import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameRoundEnded } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoundEndCard } from './round-end-card';

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: vi.fn().mockResolvedValue(null) };
});

const players = ['ada', 'bob', 'cy', 'dee'].map((id) => ({
    id,
    presenceId: `presence-${id}`,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    avatarUrl: '',
    isGuest: false,
}));

function ended(number: number, roundsTotal: number | null): GameRoundEnded {
    return {
        roundId: 'round',
        outcome: 'solved',
        word: 'COFFEE',
        winnerPlayerId: null,
        leaderPlayerId: null,
        points: [],
        number,
        roundsTotal,
    };
}

function renderCard(lastEnded: GameRoundEnded, isHost: boolean) {
    const ctx = {
        snapshot: {
            room: {
                id: 'room',
                game: 'hangman',
                isHost,
                currentRoundId: 'round',
                settings: {
                    wordThemes: [],
                    turnSeconds: null,
                    autoHints: false,
                    takesTurns: false,
                    roundsPerGame: 3,
                    gifVotes: 1,
                    gifAuthorsHidden: false,
                },
            },
            me: { playerId: 'ada' },
            games: [{ value: 'hangman', label: 'Hangman', available: true }],
            players,
            history: [],
            truthSets: null,
            round: null,
            leaderboard: [
                { playerId: 'cy', points: 4, wins: 1, roundsPlayed: 3 },
                { playerId: 'ada', points: 12, wins: 2, roundsPlayed: 3 },
                { playerId: 'dee', points: 1, wins: 0, roundsPlayed: 3 },
                { playerId: 'bob', points: 9, wins: 1, roundsPlayed: 3 },
            ],
        },
        lastEnded,
        online: players.map((player) => ({ id: player.presenceId })),
        dispatch: vi.fn(),
        run: <T,>(mutation: Promise<T>) => mutation,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <RoundEndCard />
        </RoomProvider>,
    );
}

describe('RoundEndCard', () => {
    it('closes the last round of a game with the top three of the room and the host’s "New game"', () => {
        renderCard(ended(3, 3), true);

        expect(screen.getByRole('heading', { name: 'Game over' })).toBeTruthy();

        const podium = screen.getByRole('list', { name: 'Final scores' });

        expect(
            within(podium)
                .getAllByRole('listitem')
                .map((item) => item.textContent),
        ).toEqual(['1Ada12 points', '2Bob9 points', '3Cy4 points']);
        expect(screen.getByRole('button', { name: 'New game' })).toBeTruthy();
    });

    it('leaves the players waiting for the host after the last round', () => {
        renderCard(ended(3, 3), false);

        expect(screen.getByRole('heading', { name: 'Game over' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'New game' })).toBeNull();
        expect(screen.getByText('Waiting for the host to start.')).toBeTruthy();
    });

    it('is unchanged between two rounds of a game', () => {
        renderCard(ended(2, 3), true);

        expect(screen.queryByRole('heading', { name: 'Game over' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Next round' })).toBeTruthy();
    });
});
