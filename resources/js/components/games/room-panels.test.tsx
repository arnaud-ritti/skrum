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
        round:
            round === null
                ? null
                : ({ id: 'round', game, turnOrder: [], ...round } as GameRound),
    } as unknown as GameSnapshot;
}

function Room({ snapshot }: { snapshot: GameSnapshot }) {
    const panels = useRoomPanels({ snapshot, lastEnded: null });

    return <GameLayout {...panels} stage={<p>stage</p>} />;
}

function renderRoom(value: GameSnapshot) {
    const ctx = {
        snapshot: value,
        lastEnded: null,
        online: players.map((player) => ({ id: player.presenceId })),
        run: <T,>(mutation: Promise<T>) => mutation,
        refetch: vi.fn(),
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <Room snapshot={value} />
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
});
