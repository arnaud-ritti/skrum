import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { GameRoomSummary, TeamGameLeaderboardRow } from '@/types';
import { TeamGames } from './team-games';
import type { TeamGamesProps } from './team-games';
import {
    removeTeamGameRoom,
    upsertTeamGameRoom,
} from './use-team-games-channel';

type Listener = (payload: unknown) => void;

const realtime = vi.hoisted(() => ({
    configured: true,
    status: 'connected',
    channels: new Map<string, Map<string, (payload: unknown) => void>>(),
    subscribed: new Map<string, () => void>(),
    left: [] as string[],
}));

const inertia = vi.hoisted(() => ({
    page: {
        props: { translations: {}, auth: { user: { id: 'u2' } } },
        rescuedProps: [] as string[],
    },
    post: vi.fn(),
    reload: vi.fn(),
}));

vi.mock('@laravel/echo-react', () => ({
    echoIsConfigured: () => realtime.configured,
    echo: () => ({
        connector: {
            onConnectionChange: () => () => {},
            connectionStatus: () => realtime.status,
        },
        private: (name: string) => {
            const listeners = new Map<string, Listener>();

            realtime.channels.set(name, listeners);

            const channel = {
                subscribed: (callback: () => void) => {
                    realtime.subscribed.set(name, callback);

                    return channel;
                },
                listen: (event: string, listener: Listener) => {
                    listeners.set(event, listener);

                    return channel;
                },
            };

            return channel;
        },
        leave: (name: string) => {
            realtime.left.push(name);
        },
    }),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => inertia.page,
        router: { post: inertia.post, reload: inertia.reload },
    };
});

const Channel = 'team-games.t1';

function room(overrides: Partial<GameRoomSummary> = {}): GameRoomSummary {
    return {
        id: 'r1',
        name: 'Daily warm-up',
        game: 'hangman',
        gameLabel: 'Hangman',
        access: 'team',
        status: 'waiting',
        players: [],
        playersCount: 0,
        roundsCount: 0,
        roundStartedAt: null,
        updatedAt: null,
        ...overrides,
    };
}

function row(
    userId: string,
    name: string,
    points: number,
    streak = 0,
): TeamGameLeaderboardRow {
    return {
        userId,
        name,
        avatarUrl: `/avatars/${userId}.svg`,
        points,
        wins: 1,
        roundsPlayed: 3,
        streak,
    };
}

function props(overrides: Partial<TeamGamesProps> = {}): TeamGamesProps {
    return {
        workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
        team: { id: 't1', name: 'Atlas' },
        rooms: [room()],
        gameOptions: [{ value: 'hangman', label: 'Hangman', available: true }],
        canCreate: true,
        roomLimit: 10,
        period: '30d',
        leaderboard: [],
        ...overrides,
    } as TeamGamesProps;
}

function send(event: string, payload: unknown): void {
    act(() => {
        realtime.channels.get(Channel)?.get(event)?.(payload);
    });
}

function roomNames(): string[] {
    return [...document.querySelectorAll('[data-slot="game-room"] a')].map(
        (link) => link.getAttribute('aria-label') ?? '',
    );
}

beforeEach(() => {
    realtime.configured = true;
    realtime.status = 'connected';
    realtime.channels.clear();
    realtime.subscribed.clear();
    realtime.left.length = 0;
    inertia.page.rescuedProps = [];
    inertia.post.mockReset();
    inertia.reload.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('room list helpers', () => {
    it('puts a changed or new room first among the rooms of its status', () => {
        const rooms = [room({ id: 'a' }), room({ id: 'b' })];

        expect(
            upsertTeamGameRoom(rooms, room({ id: 'b', name: 'Renamed' })).map(
                (item) => `${item.id}:${item.name}`,
            ),
        ).toEqual(['b:Renamed', 'a:Daily warm-up']);
        expect(
            upsertTeamGameRoom(rooms, room({ id: 'c' })).map((item) => item.id),
        ).toEqual(['c', 'a', 'b']);
    });

    it('keeps the order of the server: a room in play first, then the latest changed', () => {
        const rooms = [
            room({
                id: 'live',
                status: 'playing',
                updatedAt: '2026-10-01T10:00:00Z',
            }),
            room({ id: 'recent', updatedAt: '2026-10-02T09:00:00Z' }),
            room({ id: 'old', updatedAt: '2026-09-30T09:00:00Z' }),
        ];

        expect(
            upsertTeamGameRoom(
                rooms,
                room({ id: 'new', updatedAt: '2026-10-02T10:00:00Z' }),
            ).map((item) => item.id),
        ).toEqual(['live', 'new', 'recent', 'old']);
        expect(
            upsertTeamGameRoom(
                rooms,
                room({
                    id: 'old',
                    status: 'playing',
                    updatedAt: '2026-10-02T10:00:00Z',
                }),
            ).map((item) => item.id),
        ).toEqual(['old', 'live', 'recent']);
    });

    it('removes a room and leaves the list alone for an unknown id', () => {
        const rooms = [room({ id: 'a' }), room({ id: 'b' })];

        expect(removeTeamGameRoom(rooms, 'a').map((item) => item.id)).toEqual([
            'b',
        ]);
        expect(removeTeamGameRoom(rooms, 'zz')).toBe(rooms);
    });
});

describe('TeamGames', () => {
    it('shows a room in play as live with its players and when it started, and a room without a round as waiting', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-02T10:04:30Z'));

        renderWithProviders(
            <TeamGames
                {...props({
                    rooms: [
                        room({ id: 'w', name: 'Later' }),
                        room({
                            id: 'p',
                            name: 'Now',
                            status: 'playing',
                            roundStartedAt: '2026-10-02T10:00:00Z',
                            playersCount: 7,
                            players: ['Ada', 'Bob', 'Cy', 'Di', 'Ed'].map(
                                (name, index) => ({
                                    id: `p${index}`,
                                    name,
                                    avatarUrl: `/avatars/${index}.svg`,
                                }),
                            ),
                        }),
                    ],
                })}
            />,
        );

        expect(roomNames()).toEqual([
            'Now, Hangman, Live, 7 players',
            'Later, Hangman, Waiting for players, 0 players',
        ]);

        const live = screen.getByRole('link', { name: /^Now/ });

        expect(live.textContent).toContain('started 4 min ago');
        expect(live.querySelector('[data-status="live"]')).not.toBeNull();
        expect(
            live.querySelector('[data-slot="avatar-stack-more"]')?.textContent,
        ).toBe('+4');
        expect(live.getAttribute('href')).toBe('/games/p');
        expect(screen.getByText('1 live')).toBeTruthy();
    });

    it('tells when a round started from the time it starts playing, not from the page load', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-02T10:00:00Z'));

        renderWithProviders(<TeamGames {...props()} />);

        vi.setSystemTime(new Date('2026-10-02T10:10:00Z'));
        send('.team.game-room.changed', {
            room: room({
                status: 'playing',
                roundStartedAt: '2026-10-02T10:05:00Z',
                playersCount: 1,
            }),
        });

        expect(
            screen.getByRole('link', { name: /^Daily warm-up/ }).textContent,
        ).toContain('started 5 min ago');
    });

    it('carries the one data-realtime of the page: connecting, then connected once the team channel answers', () => {
        renderWithProviders(<TeamGames {...props()} />);

        const root = document.querySelector('[data-slot="team-games"]');

        expect(document.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(root?.getAttribute('data-realtime')).toBe('connecting');

        act(() => realtime.subscribed.get(Channel)?.());

        expect(root?.getAttribute('data-realtime')).toBe('connected');
    });

    it('adds, changes and removes a room as the team channel says, and leaves the channel on unmount', () => {
        const { unmount } = renderWithProviders(<TeamGames {...props()} />);

        send('.team.game-room.changed', {
            room: room({ id: 'r2', name: 'Friday fun' }),
        });

        expect(roomNames()).toEqual([
            'Friday fun, Hangman, Waiting for players, 0 players',
            'Daily warm-up, Hangman, Waiting for players, 0 players',
        ]);

        send('.team.game-room.changed', {
            room: room({
                id: 'r2',
                name: 'Friday games',
                status: 'playing',
                roundStartedAt: new Date().toISOString(),
                playersCount: 1,
            }),
        });

        expect(roomNames()[0]).toBe('Friday games, Hangman, Live, 1 player');
        expect(
            screen.getByRole('link', { name: /^Friday games/ }).textContent,
        ).toContain('started just now');

        send('.team.game-room.deleted', { roomId: 'r2' });

        expect(roomNames()).toEqual([
            'Daily warm-up, Hangman, Waiting for players, 0 players',
        ]);

        unmount();

        expect(realtime.left).toEqual([Channel]);
    });

    it('reloads the leaderboard when a round ends in a room of the list', () => {
        renderWithProviders(
            <TeamGames
                {...props({
                    rooms: [
                        room({
                            status: 'playing',
                            roundStartedAt: new Date().toISOString(),
                        }),
                    ],
                })}
            />,
        );

        send('.team.game-room.changed', {
            room: room({ name: 'Renamed', status: 'playing' }),
        });

        expect(inertia.reload).not.toHaveBeenCalled();

        send('.team.game-room.changed', { room: room({ roundsCount: 1 }) });

        expect(inertia.reload).toHaveBeenCalledWith({ only: ['leaderboard'] });
    });

    it('takes the rooms of the server again when the page prop changes', () => {
        const { rerender } = renderWithProviders(<TeamGames {...props()} />);

        send('.team.game-room.changed', { room: room({ id: 'r2' }) });
        rerender(
            <TeamGames
                {...props({ rooms: [room({ name: 'From server' })] })}
            />,
        );

        expect(roomNames()).toEqual([
            'From server, Hangman, Waiting for players, 0 players',
        ]);
    });

    it('marks the current user and shows a streak on the podium', () => {
        renderWithProviders(
            <TeamGames
                {...props({
                    leaderboard: [row('u1', 'Ada', 9, 2), row('u2', 'Bob', 4)],
                })}
            />,
        );

        const first = document.querySelector(
            '[data-slot="podium-place"][data-place="1"]',
        );
        const second = document.querySelector(
            '[data-slot="podium-place"][data-place="2"]',
        );

        expect(first?.textContent).toContain('2-week streak');
        expect(first?.hasAttribute('data-me')).toBe(false);
        expect(second?.hasAttribute('data-me')).toBe(true);
        expect(second?.textContent).not.toContain('streak');
    });

    it('shows the skeleton while the leaderboard is deferred, and the retry when it could not load', async () => {
        const { rerender } = renderWithProviders(
            <TeamGames {...props({ leaderboard: undefined })} />,
        );

        expect(
            document.querySelector('[data-slot="leaderboard-skeleton"]'),
        ).not.toBeNull();

        inertia.page.rescuedProps = ['leaderboard'];
        rerender(<TeamGames {...props({ leaderboard: undefined })} />);

        expect(
            screen.getByText('Could not load the leaderboard.'),
        ).toBeTruthy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Try again' }),
        );

        expect(inertia.reload).toHaveBeenCalledWith(
            expect.objectContaining({ only: ['leaderboard'] }),
        );
    });

    it('asks the server for the leaderboard of the other period only', async () => {
        renderWithProviders(<TeamGames {...props()} />);

        await userEvent.click(screen.getByRole('tab', { name: 'All time' }));

        expect(inertia.reload).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { period: 'all' },
                only: ['period', 'leaderboard'],
            }),
        );
    });

    it('marks the leaderboard as busy while the other period loads', async () => {
        renderWithProviders(
            <TeamGames {...props({ leaderboard: [row('u1', 'Ada', 9)] })} />,
        );

        const panel = () =>
            document.querySelector(
                '[data-slot="leaderboard"] [role="tabpanel"]',
            );

        expect(panel()?.getAttribute('aria-busy')).toBe('false');

        await userEvent.click(screen.getByRole('tab', { name: 'All time' }));

        const visit = inertia.reload.mock.calls[0][0] as {
            onStart: () => void;
            onFinish: () => void;
        };

        act(() => visit.onStart());

        expect(panel()?.getAttribute('aria-busy')).toBe('true');

        act(() => visit.onFinish());

        expect(panel()?.getAttribute('aria-busy')).toBe('false');
    });

    it('asks the server for the rooms again when the team channel comes back after a drop', () => {
        renderWithProviders(<TeamGames {...props()} />);

        act(() => realtime.subscribed.get(Channel)?.());

        expect(inertia.reload).not.toHaveBeenCalled();

        act(() => realtime.subscribed.get(Channel)?.());

        expect(inertia.reload).toHaveBeenCalledTimes(1);
        expect(inertia.reload).toHaveBeenCalledWith({
            only: ['rooms', 'canCreate', 'leaderboard'],
        });
    });

    it('asks whether a room can be created again when a room is deleted at the limit, not below it', () => {
        const { unmount } = renderWithProviders(<TeamGames {...props()} />);

        send('.team.game-room.deleted', { roomId: 'r1' });

        expect(inertia.reload).not.toHaveBeenCalled();

        unmount();
        renderWithProviders(<TeamGames {...props({ canCreate: false })} />);

        send('.team.game-room.deleted', { roomId: 'r1' });

        expect(inertia.reload).toHaveBeenCalledWith({ only: ['canCreate'] });
    });

    it('creates a room, and keeps the dialog open with the message of the server when it is refused', async () => {
        inertia.post.mockImplementation(
            (
                _url: string,
                _data: unknown,
                options: {
                    onError: (errors: Record<string, string>) => void;
                    onFinish: () => void;
                },
            ) => {
                options.onError({
                    name: 'This team already has 10 game rooms.',
                });
                options.onFinish();
            },
        );

        renderWithProviders(<TeamGames {...props()} />);

        await userEvent.click(screen.getByRole('button', { name: 'New room' }));
        await userEvent.type(
            document.querySelector('#new-room-name') as HTMLElement,
            'Friday fun',
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Create room' }),
        );

        await waitFor(() =>
            expect(
                screen.getByText('This team already has 10 game rooms.'),
            ).toBeTruthy(),
        );

        expect(inertia.post.mock.calls[0][0]).toBe('/w/nordlys/teams/t1/games');
        expect(inertia.post.mock.calls[0][1]).toEqual({
            name: 'Friday fun',
            game: 'hangman',
            access: 'team',
        });
        expect(document.querySelector('#new-room-name')).not.toBeNull();
    });

    it('hides "New room" and says why when the team is at its limit', () => {
        renderWithProviders(
            <TeamGames
                {...props({
                    canCreate: false,
                    roomLimit: 1,
                })}
            />,
        );

        expect(screen.queryByRole('button', { name: 'New room' })).toBeNull();
        expect(
            screen.getByText('This team already has 1 game room.'),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Back to the team' }),
        ).toBeTruthy();
    });

    it('stays usable without a socket', () => {
        realtime.configured = false;

        renderWithProviders(<TeamGames {...props()} />);

        expect(roomNames()).toHaveLength(1);
        expect(
            document
                .querySelector('[data-slot="team-games"]')
                ?.getAttribute('data-realtime'),
        ).toBe('connecting');
    });
});
