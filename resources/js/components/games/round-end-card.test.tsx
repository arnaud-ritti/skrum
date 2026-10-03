import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
    GameKind,
    GameRoundDetail,
    GameRoundEnded,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
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

function renderCard(
    lastEnded: GameRoundEnded | null,
    isHost: boolean,
    game: GameKind = 'hangman',
    history: GameRoundDetail[] = [],
) {
    const ctx = {
        snapshot: {
            room: {
                id: 'room',
                game,
                isHost,
                currentRoundId:
                    lastEnded === null ? (history[0]?.id ?? null) : 'round',
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
            games: [{ value: game, label: game, available: true }],
            players,
            history,
            truthSets: game === 'two_truths' ? { ready: [], mine: null } : null,
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

    it('shows the lie of a Two truths round, then my statements under the card', () => {
        renderCard(
            {
                ...ended(2, 3),
                outcome: 'revealed',
                word: null,
                leaderPlayerId: 'bob',
                statements: ['I ski', 'I sing', 'I fly'],
                lieIndex: 2,
                votes: [
                    { index: 0, playerIds: [] },
                    { index: 1, playerIds: ['cy'] },
                    { index: 2, playerIds: ['ada'] },
                ],
                points: [
                    { playerId: 'ada', points: 5, isWin: true },
                    { playerId: 'bob', points: 2, isWin: false },
                ],
            },
            true,
            'two_truths',
        );

        const result = document.querySelector<HTMLElement>(
            '[data-slot="two-truths-result"]',
        );

        expect(within(result!).getByText('Lie')).toBeTruthy();
        expect(within(result!).getAllByText('True')).toHaveLength(2);
        expect(
            document.querySelector('[data-slot="two-truths-set-form"]'),
        ).not.toBeNull();
    });

    it('fetches the lie and the votes of a Two truths round seen only in the history', async () => {
        const revealed: GameRoundDetail = {
            id: 'round',
            game: 'two_truths',
            outcome: 'revealed',
            word: null,
            question: null,
            leaderPlayerId: 'bob',
            leaderName: 'Bob',
            winnerPlayerId: null,
            winnerName: null,
            endedAt: '2026-10-03T10:00:00Z',
        };

        vi.mocked(retroRequest).mockResolvedValueOnce({
            ...revealed,
            statements: ['I ski', 'I sing', 'I fly'],
            lieIndex: 2,
            votes: [
                { index: 0, playerIds: [] },
                { index: 1, playerIds: ['cy'] },
                { index: 2, playerIds: ['ada'] },
            ],
        });

        renderCard(null, false, 'two_truths', [revealed]);

        await waitFor(() =>
            expect(
                document.querySelector('[data-slot="two-truths-result"]'),
            ).not.toBeNull(),
        );

        const result = document.querySelector<HTMLElement>(
            '[data-slot="two-truths-result"]',
        );

        expect(within(result!).getByText('I fly')).toBeTruthy();
        expect(within(result!).getByText('Lie')).toBeTruthy();
        expect(
            within(result!).getByRole('list', { name: 'Picked by Ada' }),
        ).toBeTruthy();
    });

    it('asks for my statements on the waiting stage of Two truths', () => {
        renderCard(null, false, 'two_truths');

        expect(screen.getByText('Ready to play?')).toBeTruthy();
        expect(screen.getByText('My statements')).toBeTruthy();
    });

    it('shows the weather of a Mood weather round as it ends', () => {
        renderCard(
            {
                ...ended(1, null),
                outcome: 'revealed',
                word: null,
                answered: 3,
                weather: [
                    { weather: 'sunny', count: 2 },
                    { weather: 'partly_cloudy', count: 0 },
                    { weather: 'cloudy', count: 0 },
                    { weather: 'rainy', count: 1 },
                    { weather: 'stormy', count: 0 },
                ],
            },
            false,
            'mood',
        );

        expect(screen.getAllByRole('progressbar')).toHaveLength(5);
        expect(screen.getByText('3 answered')).toBeTruthy();
    });

    it('fetches the weather of a Mood weather round seen only in the history', async () => {
        const revealed: GameRoundDetail = {
            id: 'round',
            game: 'mood',
            outcome: 'revealed',
            word: null,
            question: null,
            leaderPlayerId: null,
            leaderName: null,
            winnerPlayerId: null,
            winnerName: null,
            endedAt: '2026-10-03T10:00:00Z',
        };

        vi.mocked(retroRequest).mockResolvedValueOnce({
            ...revealed,
            answered: 2,
            weather: null,
        });

        renderCard(null, false, 'mood', [revealed]);

        expect(
            await screen.findByText(
                'Not enough answers to show the weather (3 needed).',
            ),
        ).toBeTruthy();
    });
    it('shows the drawn answer of a Guess who? round and who named whom as it ends', () => {
        renderCard(
            {
                ...ended(1, null),
                outcome: 'revealed',
                word: null,
                question: 'What was your first job?',
                drawn: { id: 'answer', text: 'Paperboy', playerId: 'bob' },
                nominations: [
                    { playerId: 'bob', voterIds: ['ada'] },
                    { playerId: 'cy', voterIds: ['dee'] },
                ],
                points: [
                    { playerId: 'ada', points: 5, isWin: true },
                    { playerId: 'bob', points: 2, isWin: false },
                ],
            },
            false,
            'guess_who',
        );

        expect(screen.getByText('Paperboy')).toBeTruthy();
        expect(screen.getByText('Written by Bob')).toBeTruthy();
        expect(screen.getByText('+5 Ada')).toBeTruthy();
    });

    it('fetches the drawn answer of a Guess who? round seen only in the history', async () => {
        const closed: GameRoundDetail = {
            id: 'round',
            game: 'guess_who',
            outcome: 'revealed',
            word: null,
            question: 'What was your first job?',
            leaderPlayerId: null,
            leaderName: null,
            winnerPlayerId: null,
            winnerName: null,
            endedAt: '2026-10-03T10:00:00Z',
        };

        vi.mocked(retroRequest).mockResolvedValueOnce({
            ...closed,
            drawn: { id: 'answer', text: 'Paperboy', playerId: 'bob' },
            nominations: [{ playerId: 'bob', voterIds: [] }],
        });

        renderCard(null, false, 'guess_who', [closed]);

        expect(await screen.findByText('Written by Bob')).toBeTruthy();
    });
});
