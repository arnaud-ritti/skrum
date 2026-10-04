import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomPlayersSide, RoomSidebar } from './room-sidebar';

afterEach(() => {
    vi.restoreAllMocks();
});

function player(id: string) {
    return {
        id,
        presenceId: `presence-${id}`,
        name: id,
        avatarUrl: null,
        isGuest: false,
    };
}

describe('RoomPlayersSide', () => {
    it('counts who is ready against the players who are online, as the tally of the votes does', () => {
        const ctx = {
            snapshot: {
                room: { id: 'r1', game: 'gif', hostPlayerId: 'ada' },
                me: { playerId: 'ada' },
                players: [player('ada'), player('bob'), player('cy')],
                leaderboard: [],
                history: [],
                round: {
                    id: 'round',
                    game: 'gif',
                    revealedAt: null,
                    answers: [{ playerId: 'bob' }],
                    myAnswer: null,
                },
            },
            lastEnded: null,
            online: [{ id: 'presence-ada' }, { id: 'presence-bob' }],
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomPlayersSide highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(screen.getByRole('heading', { name: 'Participants' }).id).toBe(
            'game-players',
        );
        expect(screen.getByText('How it works')).toBeTruthy();
        expect(
            document.querySelector('[data-slot="player-points"]'),
        ).toBeNull();
        expect(screen.getByText('1 / 2')).toBeTruthy();
        expect(
            document
                .querySelector('[data-slot="gif-ready"]')
                ?.getAttribute('aria-valuemax'),
        ).toBe('2');
        expect(screen.getByText('3 players')).toBeTruthy();
    });
});

describe('RoomSidebar', () => {
    it('is one Scores list, without tabs, beside the participants of Sprint in one GIF', () => {
        const ctx = {
            snapshot: {
                room: { id: 'r1', game: 'gif', hostPlayerId: 'ada' },
                me: { playerId: 'ada' },
                players: [player('ada'), player('bob')],
                leaderboard: [
                    { playerId: 'bob', points: 2, wins: 1, roundsPlayed: 1 },
                ],
                history: [],
                round: null,
            },
            lastEnded: null,
            online: [{ id: 'presence-ada' }],
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomSidebar highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(screen.queryByRole('tab')).toBeNull();
        expect(screen.getByRole('heading', { name: 'Scores' }).id).toBe(
            'game-scores',
        );
        expect(screen.getByLabelText('2 points')).toBeTruthy();
        expect(screen.queryByText('How it works')).toBeNull();
    });

    it('heads the column with "Your pick" while the players of Sprint in one GIF pick, the scores under it', () => {
        const ctx = {
            snapshot: {
                room: { id: 'r1', game: 'gif', hostPlayerId: 'ada' },
                me: { playerId: 'ada' },
                players: [player('ada'), player('bob')],
                leaderboard: [],
                history: [],
                round: {
                    id: 'round',
                    game: 'gif',
                    revealedAt: null,
                    answers: [],
                    myAnswer: null,
                },
            },
            lastEnded: null,
            online: [{ id: 'presence-ada' }],
        } as unknown as RoomContextValue;

        vi.spyOn(window, 'matchMedia').mockImplementation(
            (query: string) =>
                ({
                    matches: true,
                    media: query,
                    addEventListener: () => undefined,
                    removeEventListener: () => undefined,
                }) as unknown as MediaQueryList,
        );

        const { unmount } = renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomSidebar highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(
            screen
                .getAllByRole('heading')
                .map((heading) => heading.textContent),
        ).toEqual(['Your pick', 'Scores']);

        unmount();
        renderWithProviders(
            <RoomProvider
                value={
                    {
                        ...ctx,
                        snapshot: {
                            ...ctx.snapshot,
                            round: {
                                ...ctx.snapshot.round,
                                revealedAt: '2026-10-02T10:00:00Z',
                            },
                        },
                    } as unknown as RoomContextValue
                }
            >
                <RoomSidebar highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(screen.queryByRole('heading', { name: 'Your pick' })).toBeNull();
    });

    it('leaves the players of Draw & Guess to the left column', () => {
        const ctx = {
            snapshot: {
                room: { id: 'r1', game: 'draw', hostPlayerId: 'ada' },
                me: { playerId: 'ada' },
                players: [player('ada')],
                leaderboard: [],
                history: [],
                round: null,
            },
            lastEnded: null,
            online: [{ id: 'presence-ada' }],
        } as unknown as RoomContextValue;

        vi.spyOn(window, 'matchMedia').mockImplementation(
            (query: string) =>
                ({
                    matches: true,
                    media: query,
                    addEventListener: () => undefined,
                    removeEventListener: () => undefined,
                }) as unknown as MediaQueryList,
        );

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomSidebar highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(screen.queryByRole('heading', { name: 'Guesses' })).toBeNull();
        expect(document.querySelector('[data-slot="player-row"]')).toBeNull();
    });

    it('counts a lone player in the singular', () => {
        const ctx = {
            snapshot: {
                room: { id: 'r1', game: 'hangman', hostPlayerId: 'ada' },
                me: { playerId: 'ada' },
                players: [player('ada')],
                leaderboard: [],
                history: [],
                round: null,
            },
            lastEnded: null,
            online: [{ id: 'presence-ada' }],
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomSidebar highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(screen.getByText('1 player')).toBeTruthy();
        expect(screen.queryByText('1 players')).toBeNull();
    });
});

describe('RoomPlayersSide for an observer', () => {
    it('has no form for statements while another player tells', () => {
        const ctx = {
            snapshot: {
                room: { id: 'r1', game: 'two_truths', hostPlayerId: 'bob' },
                me: { playerId: 'ada' },
                players: [player('ada'), player('bob')],
                leaderboard: [],
                history: [],
                truthSets: { ready: [], mine: null },
                round: {
                    id: 'round',
                    game: 'two_truths',
                    leaderPlayerId: 'bob',
                },
                viewerIsObserver: true,
            },
            lastEnded: null,
            online: [],
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomPlayersSide highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(
            document.querySelector('[data-slot="two-truths-set-form"]'),
        ).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
    });
});
