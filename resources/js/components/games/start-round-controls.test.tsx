import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    GameKind,
    GameRoomSettingsInfo,
    GameRoundEnded,
    GameTruthSets,
} from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { StartRoundControls } from './start-round-controls';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
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
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue(undefined);
});

const players = ['ada', 'bob', 'cy', 'dee'].map((id) => ({
    id,
    presenceId: `presence-${id}`,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    avatarUrl: '',
    isGuest: false,
}));

type Setup = {
    game: GameKind;
    online: string[];
    settings?: Partial<GameRoomSettingsInfo>;
    truthSets?: GameTruthSets | null;
    lastEnded?: Partial<GameRoundEnded> | null;
};

function renderControls({
    game,
    online,
    settings = {},
    truthSets = null,
    lastEnded = null,
}: Setup) {
    const ctx = {
        snapshot: {
            room: {
                id: 'room',
                game,
                isHost: true,
                settings: {
                    wordThemes: [],
                    turnSeconds: null,
                    autoHints: false,
                    takesTurns: false,
                    roundsPerGame: null,
                    gifVotes: 1,
                    gifAuthorsHidden: false,
                    ...settings,
                },
            },
            me: { playerId: 'ada' },
            games: [{ value: game, label: game, available: true }],
            players,
            history: [],
            truthSets,
        },
        lastEnded,
        online: online.map((id) => ({ id: `presence-${id}` })),
        dispatch: vi.fn(),
        run: <T,>(mutation: Promise<T>) => mutation,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <StartRoundControls label="Next round" />
        </RoomProvider>,
    );
}

function startButton(): HTMLButtonElement {
    return screen.getByRole('button', { name: /round|game/i });
}

function postedBody(): unknown {
    return mocks.request.mock.calls[0][1];
}

describe('StartRoundControls, Two truths', () => {
    const ready: GameTruthSets = { ready: ['dee', 'bob'], mine: null };

    it('asks who tells among the ready players only', async () => {
        renderControls({
            game: 'two_truths',
            online: ['ada', 'bob', 'cy'],
            truthSets: ready,
        });

        const picker = screen.getByRole('combobox', { name: 'Who tells?' });

        expect(picker.textContent).toBe('Bob');

        await userEvent.click(picker);

        expect(
            within(screen.getByRole('listbox'))
                .getAllByRole('option')
                .map((option) => option.textContent),
        ).toEqual(['Bob', 'Dee']);
    });

    it('waits under three online players', () => {
        renderControls({
            game: 'two_truths',
            online: ['ada', 'bob'],
            truthSets: ready,
        });

        expect(screen.getByText('Waiting for players (3 needed)')).toBeTruthy();
        expect(startButton().disabled).toBe(true);
    });

    it('cannot start when no set is ready', () => {
        renderControls({
            game: 'two_truths',
            online: ['ada', 'bob', 'cy'],
            truthSets: { ready: [], mine: null },
        });

        expect(screen.getByText('No one has statements ready.')).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(startButton().disabled).toBe(true);
    });

    it('names the proposed teller when it starts', async () => {
        renderControls({
            game: 'two_truths',
            online: ['ada', 'bob', 'cy'],
            truthSets: ready,
        });

        await userEvent.click(startButton());

        expect(postedBody()).toEqual({ leader_player_id: 'bob' });
    });
});

describe('StartRoundControls, games in turns', () => {
    it('posts the online players in join order for hangman in turns', async () => {
        renderControls({
            game: 'hangman',
            online: ['cy', 'ada'],
            settings: { takesTurns: true },
        });

        await userEvent.click(startButton());

        expect(postedBody()).toEqual({ turn_order: ['ada', 'cy'] });
    });

    it('posts nothing for hangman without turns', async () => {
        renderControls({ game: 'hangman', online: ['ada'] });

        await userEvent.click(startButton());

        expect(postedBody()).toEqual({});
    });

    it('posts the order of a Quick question', async () => {
        renderControls({ game: 'quick_question', online: ['bob', 'ada'] });

        await userEvent.click(startButton());

        expect(postedBody()).toEqual({ turn_order: ['ada', 'bob'] });
    });
});

describe('StartRoundControls, the end of a game', () => {
    it('offers a new game after the last round of a numbered game', () => {
        renderControls({
            game: 'hangman',
            online: ['ada'],
            lastEnded: { roundId: 'r', number: 3, roundsTotal: 3, points: [] },
        });

        expect(screen.getByRole('button', { name: 'New game' })).toBeTruthy();
    });

    it('offers the next round within a numbered game', () => {
        renderControls({
            game: 'hangman',
            online: ['ada'],
            lastEnded: { roundId: 'r', number: 2, roundsTotal: 3, points: [] },
        });

        expect(screen.getByRole('button', { name: 'Next round' })).toBeTruthy();
    });
});
