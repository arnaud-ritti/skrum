import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { GameKind, GameRound, GameSnapshot } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GameLayout } from './game-layout';
import { RoomProvider, type RoomContextValue } from './room-context';
import { useRoomPanels } from './room-panels';

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: vi.fn().mockResolvedValue(null) };
});

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
});

afterEach(() => {
    vi.restoreAllMocks();
});

function viewport(widestRem: number): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches:
                    Number(/min-width: (\d+)rem/.exec(query)?.[1]) <= widestRem,
                media: query,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }) as unknown as MediaQueryList,
    );
}

const players = ['ada', 'bob'].map((id) => ({
    id,
    presenceId: `presence-${id}`,
    name: id,
    avatarUrl: '',
    isGuest: false,
}));

function snapshot(
    game: GameKind,
    round: Partial<GameRound> | null,
    room: { isHost?: boolean; canManage?: boolean } = {},
    truthSets: GameSnapshot['truthSets'] = null,
): GameSnapshot {
    return {
        room: {
            id: 'room',
            game,
            isHost: true,
            canManage: true,
            isIcebreaker: false,
            access: 'link',
            hostPlayerId: 'ada',
            settings: {
                wordThemes: [],
                turnSeconds: 30,
                autoHints: false,
                takesTurns: true,
                roundsPerGame: null,
                gifVotes: 1,
                gifAuthorsHidden: false,
            },
            ...room,
        },
        me: { playerId: 'ada' },
        games: [{ value: game, label: game, available: true }],
        players,
        history: [],
        leaderboard: [],
        truthSets,
        round:
            round === null
                ? null
                : ({ id: 'round', game, turnOrder: [], ...round } as GameRound),
    } as unknown as GameSnapshot;
}

function Room({
    snapshot,
    watchChoice = false,
}: {
    snapshot: GameSnapshot;
    watchChoice?: boolean;
}) {
    const panels = useRoomPanels({ snapshot, lastEnded: null, watchChoice });

    return <GameLayout {...panels} stage={<p>stage</p>} />;
}

function renderRoom(value: GameSnapshot, watchChoice = false) {
    const ctx = {
        snapshot: value,
        lastEnded: null,
        online: players.map((player) => ({ id: player.presenceId })),
        run: <T,>(mutation: Promise<T>) => mutation,
        refetch: vi.fn(),
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <Room snapshot={value} watchChoice={watchChoice} />
        </RoomProvider>,
    );
}

describe('useRoomPanels', () => {
    it('sets the game under its cards and shows the order under the scores', () => {
        viewport(100);
        renderRoom(
            snapshot('hangman', {
                turnOrder: ['ada', 'bob'],
                turnPlayerId: 'bob',
            }),
        );

        const left = document.querySelector<HTMLElement>(
            '[data-slot="game-left"]',
        );
        const right = document.querySelector<HTMLElement>(
            '[data-slot="game-right"]',
        );

        expect(
            left?.querySelector('[data-slot="game-settings-card"]'),
        ).not.toBeNull();
        expect(right?.querySelector('[data-slot="turn-order"]')).not.toBeNull();
    });

    it('puts the round settings of Draw & Guess and its drawing order in the players column', () => {
        viewport(100);
        renderRoom(snapshot('draw', null));

        const left = document.querySelector<HTMLElement>(
            '[data-slot="game-left"]',
        );

        expect(within(left!).getByText('Round settings')).toBeTruthy();
        expect(within(left!).getByText('Drawing order')).toBeTruthy();
    });

    it('gives a manager who is not the host the settings without the cards', () => {
        viewport(100);
        renderRoom(snapshot('hangman', null, { isHost: false }));

        const left = document.querySelector<HTMLElement>(
            '[data-slot="game-left"]',
        );

        expect(left?.getAttribute('aria-label')).toBe('Game settings');
        expect(left?.querySelector('[data-slot="game-picker"]')).toBeNull();
    });

    it('holds the settings card in the chooser sheet of a phone', async () => {
        viewport(30);
        renderRoom(snapshot('hangman', null));

        expect(
            document.querySelector('[data-slot="game-settings-card"]'),
        ).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'Choose a game' }),
        );

        const sheet = await screen.findByRole('dialog');

        expect(
            sheet.querySelector('[data-slot="game-settings-card"]'),
        ).not.toBeNull();
    });

    it('puts the puzzles of Decoded above the settings card, the game cards behind the chooser', async () => {
        viewport(100);
        renderRoom(snapshot('decoded', { number: 1, roundsTotal: 3 }));

        const left = document.querySelector<HTMLElement>(
            '[data-slot="game-left"]',
        );
        const puzzles = left?.querySelector('[data-slot="decoded-puzzles"]');
        const settings = left?.querySelector(
            '[data-slot="game-settings-card"]',
        );

        expect(left?.getAttribute('aria-label')).toBe('Puzzles');
        expect(puzzles).not.toBeNull();
        expect(
            puzzles!.compareDocumentPosition(settings!) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(left?.querySelector('[data-slot="game-picker"]')).toBeNull();

        await userEvent.click(
            within(left!).getByRole('button', { name: 'Choose a game' }),
        );

        const sheet = await screen.findByRole('dialog');

        expect(sheet.querySelector('[data-slot="game-picker"]')).not.toBeNull();
    });

    it('shows the puzzles of Decoded to a player who does not manage the room', () => {
        viewport(100);
        renderRoom(
            snapshot(
                'decoded',
                { number: 2, roundsTotal: null },
                { isHost: false, canManage: false },
            ),
        );

        const left = document.querySelector<HTMLElement>(
            '[data-slot="game-left"]',
        );

        expect(
            left?.querySelector('[data-slot="decoded-puzzles"]'),
        ).not.toBeNull();
        expect(
            left?.querySelector('[data-slot="game-settings-card"]'),
        ).toBeNull();
    });

    it('keeps the puzzles of Decoded between two rounds of the game for a player', () => {
        viewport(100);
        const value = snapshot('decoded', null, {
            isHost: false,
            canManage: false,
        });

        value.room.settings.roundsPerGame = 8;
        value.history = [3, 2, 1].map(
            (number) =>
                ({
                    id: `round-${number}`,
                    game: 'decoded',
                    number,
                    roundsTotal: 8,
                    word: `word ${number}`,
                    winnerName: null,
                    clue: ['🦁'],
                }) as GameSnapshot['history'][number],
        );
        renderRoom(value);

        const left = document.querySelector<HTMLElement>(
            '[data-slot="game-left"]',
        );

        expect(left?.getAttribute('aria-label')).toBe('Puzzles');
        expect(
            within(left!)
                .getAllByRole('listitem')
                .map((row) => row.getAttribute('data-state')),
        ).toEqual([
            'done',
            'done',
            'done',
            'next',
            'next',
            'next',
            'next',
            'next',
        ]);
    });

    it('keeps the game cards of a retro reachable behind a chooser for its players during a Decoded round', async () => {
        viewport(100);
        renderRoom(
            snapshot(
                'decoded',
                { number: 2, roundsTotal: 3 },
                { isHost: false, canManage: false },
            ),
            true,
        );

        const left = document.querySelector<HTMLElement>(
            '[data-slot="game-left"]',
        );

        expect(
            left?.querySelector('[data-slot="decoded-puzzles"]'),
        ).not.toBeNull();

        await userEvent.click(
            within(left!).getByRole('button', { name: 'Games' }),
        );

        const sheet = await screen.findByRole('dialog');

        expect(sheet.querySelector('[data-slot="game-picker"]')).not.toBeNull();
    });

    it('keeps the puzzles of Decoded off a phone, where the round line stands for them', () => {
        viewport(30);
        renderRoom(snapshot('decoded', { number: 4, roundsTotal: 8 }));

        expect(
            document.querySelector('[data-slot="decoded-puzzles"]'),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Puzzles' })).toBeNull();
    });

    it('puts the players of Two truths on the left, marked ready, with the order of tellers and my statements while another tells', () => {
        viewport(100);
        renderRoom(
            snapshot(
                'two_truths',
                { leaderPlayerId: 'bob', statements: ['a', 'b', 'c'] },
                {},
                {
                    ready: ['ada'],
                    mine: {
                        statements: ['One', 'Two', 'Three'],
                        lieIndex: 0,
                        played: false,
                    },
                },
            ),
        );

        const left = document.querySelector<HTMLElement>(
            '[data-slot="game-left"]',
        );
        const right = document.querySelector<HTMLElement>(
            '[data-slot="game-right"]',
        );

        expect(within(left!).getByText('Players')).toBeTruthy();
        const participants = left!.querySelector<HTMLElement>(
            '[data-slot="room-participants"]',
        );

        expect(
            within(participants!).getByText('Statements ready'),
        ).toBeTruthy();
        expect(within(participants!).getByText('telling')).toBeTruthy();
        expect(within(left!).getByText('Order of tellers')).toBeTruthy();
        expect(within(left!).getByText('My statements')).toBeTruthy();
        expect(within(right!).getByText('Scores')).toBeTruthy();
        expect(within(right!).queryByText('Order of tellers')).toBeNull();
    });

    it('keeps my statements out of the column while I tell', () => {
        viewport(100);
        renderRoom(
            snapshot(
                'two_truths',
                { leaderPlayerId: 'ada', statements: ['a', 'b', 'c'] },
                {},
                { ready: [], mine: null },
            ),
        );

        expect(screen.queryByText('My statements')).toBeNull();
    });

    it('holds my statements in the players sheet of a phone', async () => {
        viewport(30);
        renderRoom(
            snapshot(
                'two_truths',
                { leaderPlayerId: 'bob', statements: ['a', 'b', 'c'] },
                {},
                { ready: [], mine: null },
            ),
        );

        await userEvent.click(screen.getByRole('button', { name: 'Players' }));

        const sheet = await screen.findByRole('dialog');

        expect(within(sheet).getByText('My statements')).toBeTruthy();
    });
});
