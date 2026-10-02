import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    GameRoomList,
    GamesLeaderboard,
    Leaderboard,
} from '@/components/skrum/games-leaderboard';
import type {
    GameOption,
    GamesLeaderboardEntry,
    GamesRoom,
} from '@/components/skrum/games-leaderboard';
import { renderWithProviders } from '@/test/render';

const gameOptions: GameOption[] = [
    { value: 'hangman', label: 'Hangman', available: true },
    { value: 'draw', label: 'Draw & Guess', available: true },
];

function room(overrides: Partial<GamesRoom> = {}): GamesRoom {
    return {
        id: 'r1',
        name: 'Daily warm-up',
        game: 'hangman',
        access: 'team',
        playersCount: 3,
        roundsCount: 2,
        href: '/games/r1',
        ...overrides,
    };
}

function entries(count: number): GamesLeaderboardEntry[] {
    return Array.from({ length: count }, (_, index) => ({
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        avatarUrl: `/avatars/${index + 1}.png`,
        points: 1000 - index,
        wins: 1,
        roundsPlayed: 5,
    }));
}

describe('GameRoomList', () => {
    it('links each room with a single accessible name and sorts live, waiting, finished', () => {
        renderWithProviders(
            <GameRoomList
                rooms={[
                    room({ id: 'a', name: 'Old', status: 'finished' }),
                    room({
                        id: 'b',
                        name: 'Soon',
                        status: 'waiting',
                        minPlayers: 3,
                        playersCount: 2,
                    }),
                    room({ id: 'c', name: 'Now', status: 'live' }),
                ]}
            />,
        );

        const links = screen.getAllByRole('link');

        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/games/r1',
            '/games/r1',
            '/games/r1',
        ]);
        expect(links[0].getAttribute('aria-label')).toBe(
            'Now, Hangman, Live, 3 players',
        );
        expect(links[1].getAttribute('aria-label')).toContain(
            'Waiting for players',
        );
        expect(links[2].getAttribute('aria-label')).toContain('Finished');
        expect(screen.getByText('needs 1 more player')).toBeTruthy();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('renders rooms without status or player list as the server sends them', () => {
        renderWithProviders(
            <GameRoomList
                rooms={[room({ name: null, game: 'draw', access: 'link' })]}
            />,
        );

        expect(
            screen.getByRole('link', {
                name: 'Draw & Guess, Draw & Guess, 3 players',
            }),
        ).toBeTruthy();
        expect(screen.getByText('Open by link')).toBeTruthy();
        expect(document.querySelector('[data-status]')).toBeNull();
    });

    it('renders a slot action beside the link, outside it', () => {
        renderWithProviders(
            <GameRoomList
                rooms={[room()]}
                roomAction={(item) => (
                    <button type="button">Delete {item.id}</button>
                )}
            />,
        );

        const button = screen.getByRole('button', { name: 'Delete r1' });

        expect(screen.getByRole('link').contains(button)).toBe(false);
    });

    it('handles 200 rooms with a scrolling list', () => {
        const rooms = Array.from({ length: 200 }, (_, index) =>
            room({ id: `r${index}`, name: `Room ${index}` }),
        );

        renderWithProviders(<GameRoomList rooms={rooms} />);

        expect(screen.getAllByRole('link')).toHaveLength(200);
        expect(
            document
                .querySelector('[data-slot="game-room-list"]')
                ?.className.includes('overflow-y-auto'),
        ).toBe(true);
    });
});

describe('Leaderboard', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders the podium in DOM order 1, 2, 3 and the list from rank 4', () => {
        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(6)}
            />,
        );

        const podium = within(screen.getByRole('list', { name: 'Podium' }));
        const places = podium.getAllByRole('listitem');

        expect(places.map((place) => place.getAttribute('data-place'))).toEqual(
            ['1', '2', '3'],
        );
        expect(within(places[0]).getByText('Player 1')).toBeTruthy();
        expect(
            document.querySelectorAll('[data-slot="leaderboard-row"]'),
        ).toHaveLength(3);
        expect(
            screen.getByText('Player 4').closest('li')?.textContent,
        ).toContain('5 rounds · 1 win');
    });

    it('passes avatar urls as image sources', async () => {
        class LoadedImage extends EventTarget {
            complete = false;
            naturalWidth = 8;
            referrerPolicy = '';
            crossOrigin: string | null = null;
            set src(_value: string) {
                queueMicrotask(() => {
                    this.complete = true;
                    this.dispatchEvent(new Event('load'));
                });
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        renderWithProviders(
            <Leaderboard
                period="all"
                onPeriodChange={vi.fn()}
                entries={entries(1)}
            />,
        );

        const image = await waitFor(() => {
            const found = document.querySelector('img');

            expect(found).not.toBeNull();

            return found as HTMLImageElement;
        });

        expect(image.getAttribute('src')).toBe('/avatars/1.png');
    });

    it('marks me in the list and on the podium', () => {
        const { rerender } = renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(6)}
                currentUserId="u5"
            />,
        );

        expect(
            document.querySelector('[data-slot="leaderboard-row"][data-me]')
                ?.textContent,
        ).toContain('Player 5');

        rerender(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(6)}
                currentUserId="u2"
            />,
        );

        expect(
            document
                .querySelector('[data-slot="podium-place"][data-me]')
                ?.getAttribute('data-place'),
        ).toBe('2');
        expect(
            document.querySelector('[data-slot="leaderboard-row"][data-me]'),
        ).toBeNull();
    });

    it('keeps the podium frame with fewer than 3 players', () => {
        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(1)}
            />,
        );

        expect(
            document.querySelectorAll('[data-slot="podium-place"]'),
        ).toHaveLength(1);
        expect(
            document.querySelectorAll('[data-slot="podium-empty"]'),
        ).toHaveLength(2);
        expect(
            document.querySelector('[data-slot="leaderboard-list"]'),
        ).toBeNull();
    });

    it('shows the empty state and keeps the period toggle', () => {
        renderWithProviders(
            <Leaderboard period="all" onPeriodChange={vi.fn()} entries={[]} />,
        );

        expect(screen.getByText('No games played yet.')).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Last 30 days' })).toBeTruthy();
    });

    it('is busy while entries are loading and shows a retry on error', () => {
        const onRetry = vi.fn();
        const { rerender } = renderWithProviders(
            <Leaderboard period="30d" onPeriodChange={vi.fn()} />,
        );

        expect(screen.getByRole('tabpanel').getAttribute('aria-busy')).toBe(
            'true',
        );

        rerender(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                error
                onRetry={onRetry}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('changes period from the keyboard', async () => {
        const onPeriodChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={onPeriodChange}
                entries={entries(4)}
            />,
        );

        screen.getByRole('tab', { name: 'Last 30 days' }).focus();
        await user.keyboard('{ArrowRight}');

        expect(onPeriodChange).toHaveBeenCalledWith('all');
    });

    it('scrolls 200 entries inside the card', () => {
        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(200)}
            />,
        );

        expect(
            document.querySelectorAll('[data-slot="leaderboard-row"]'),
        ).toHaveLength(197);
        expect(
            document
                .querySelector('[data-slot="leaderboard-list"]')
                ?.className.includes('overflow-y-auto'),
        ).toBe(true);
    });
});

describe('GamesLeaderboard', () => {
    const base = {
        gameOptions,
        period: '30d' as const,
        onPeriodChange: vi.fn(),
        onCreateRoom: vi.fn(),
    };

    it('shows the empty rooms state with a second New room button', () => {
        renderWithProviders(
            <GamesLeaderboard
                {...base}
                rooms={[]}
                canCreateRoom
                teamName="Atlas"
                backHref="/teams/1"
            />,
        );

        expect(screen.getByText('No game rooms yet.')).toBeTruthy();
        expect(
            screen.getAllByRole('button', { name: 'New room' }),
        ).toHaveLength(2);
        expect(
            screen
                .getByRole('link', { name: 'Back to the team' })
                .getAttribute('href'),
        ).toBe('/teams/1');
        expect(screen.getByText('Short games to warm up Atlas.')).toBeTruthy();
    });

    it('hides creation and explains the limit when the team cannot create rooms', () => {
        renderWithProviders(
            <GamesLeaderboard
                {...base}
                rooms={[room()]}
                canCreateRoom={false}
                roomLimit={1}
            />,
        );

        expect(screen.queryByRole('button', { name: 'New room' })).toBeNull();
        expect(
            screen.getByText('This team already has 1 game rooms.'),
        ).toBeTruthy();
    });

    it('creates a room with its name, first game and access', async () => {
        const onCreateRoom = vi.fn();

        renderWithProviders(
            <GamesLeaderboard
                {...base}
                onCreateRoom={onCreateRoom}
                rooms={[room()]}
                canCreateRoom
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'New room' }));
        const submit = await screen.findByRole('button', {
            name: 'Create room',
        });

        expect((submit as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: ' Friday fun ' },
        });
        fireEvent.click(submit);

        expect(onCreateRoom).toHaveBeenCalledWith({
            name: 'Friday fun',
            game: 'hangman',
            access: 'team',
        });
    });

    it('keeps the dialog open and shows server errors when creation is refused', async () => {
        const onCreateRoom = vi.fn(() => false as const);

        const { rerender } = renderWithProviders(
            <GamesLeaderboard
                {...base}
                onCreateRoom={onCreateRoom}
                rooms={[]}
                canCreateRoom
            />,
        );

        fireEvent.click(screen.getAllByRole('button', { name: 'New room' })[0]);
        fireEvent.change(await screen.findByLabelText('Name'), {
            target: { value: 'X' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create room' }));

        rerender(
            <GamesLeaderboard
                {...base}
                onCreateRoom={onCreateRoom}
                rooms={[]}
                canCreateRoom
                createErrors={{ name: 'Name taken' }}
            />,
        );

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Name taken',
        );
        expect(screen.getByLabelText('Name')).toBeTruthy();
    });

    it('counts live rooms in the rooms card', () => {
        renderWithProviders(
            <GamesLeaderboard
                {...base}
                rooms={[
                    room({ id: 'a', status: 'live' }),
                    room({ id: 'b', status: 'live' }),
                    room({ id: 'c', status: 'finished' }),
                ]}
                canCreateRoom
            />,
        );

        expect(screen.getByText('2 live')).toBeTruthy();
    });
});
