import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GameLayout } from './game-layout';
import { HangmanBoard } from './hangman-board';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { locale: 'en', translations: {} } }),
    };
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

const round = {
    id: 'round',
    game: 'hangman',
    misses: 1,
    maxMisses: 6,
    mask: ['q', null, null],
    pickedLetters: ['q', 'x'],
    recentPicks: [{ playerId: 'ada', letter: 'x', hit: false }],
    turnOrder: [],
    turnPlayerId: null,
} as unknown as GameRound;

function player(id: string, name: string) {
    return {
        id,
        presenceId: `presence-${id}`,
        name,
        avatarUrl: null,
        isGuest: false,
    };
}

function renderBoard(turns: Partial<GameRound> = {}, viewerIsObserver = false) {
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'hangman' },
            me: { playerId: 'ada' },
            players: [player('ada', 'Ada'), player('ines', 'Inès')],
            viewerIsObserver,
        },
        run: <T,>(mutation: Promise<T>) => mutation,
        dispatch: vi.fn(),
        refetch: vi.fn(),
    } as unknown as RoomContextValue;

    return renderWithProviders(
        <RoomProvider value={ctx}>
            <GameLayout
                stage={<HangmanBoard round={{ ...round, ...turns }} />}
            />
        </RoomProvider>,
    );
}

function wordField(): HTMLInputElement {
    return screen.getByRole('textbox', {
        name: 'Guess the whole word (+5 pts, −1 life if wrong)',
    });
}

beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue(null);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('HangmanBoard', () => {
    it('docks the keyboard under the stage on a phone, the word and the last letters above it', () => {
        viewport(24);
        renderBoard();

        const footer = document.querySelector<HTMLElement>(
            '[data-slot="game-footer"]',
        );
        const board = document.querySelector<HTMLElement>(
            '[data-slot="hangman-board"]',
        );

        expect(
            within(footer as HTMLElement).getByRole('group', {
                name: 'Letters',
            }),
        ).toBeTruthy();
        expect(screen.getAllByRole('group', { name: 'Letters' })).toHaveLength(
            1,
        );
        expect(
            within(board as HTMLElement).queryByRole('group', {
                name: 'Letters',
            }),
        ).toBeNull();
        expect(
            within(board as HTMLElement).getByRole('list', {
                name: 'Last moves',
            }),
        ).toBeTruthy();
        expect(
            within(board as HTMLElement).getByRole('heading', {
                level: 3,
                name: 'Last moves',
            }),
        ).toBeTruthy();
    });

    it('keeps the keyboard in the flow of the stage on a wider screen', () => {
        viewport(50);
        renderBoard();

        expect(document.querySelector('[data-slot="game-footer"]')).toBeNull();
        expect(
            within(
                document.querySelector<HTMLElement>(
                    '[data-slot="hangman-board"]',
                ) as HTMLElement,
            ).getByRole('group', { name: 'Letters' }),
        ).toBeTruthy();
    });

    it('lets the viewer pick and guess the word in their turn', () => {
        viewport(50);
        renderBoard({ turnOrder: ['ada', 'ines'], turnPlayerId: 'ada' });

        expect(
            document.querySelector('[data-slot="hangman-turn-banner"]')
                ?.textContent,
        ).toContain('Your turn, Ada — pick a letter');
        expect(wordField().hasAttribute('aria-disabled')).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'u' }));

        expect(mocks.request).toHaveBeenCalledTimes(1);
    });

    it('locks the keys and the word field in another player turn, and says whose turn it is', () => {
        viewport(50);
        renderBoard({ turnOrder: ['ada', 'ines'], turnPlayerId: 'ines' });

        const keyboard = screen.getByRole('group', { name: 'Letters' });

        expect(within(keyboard).getByText("Inès's turn")).toBeTruthy();
        expect(wordField().getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'u' }));

        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('shows no turn banner in a round without turns', () => {
        viewport(50);
        renderBoard({ turnOrder: [], turnPlayerId: null });

        expect(
            document.querySelector('[data-slot="hangman-turn-banner"]'),
        ).toBeNull();
        expect(wordField().hasAttribute('aria-disabled')).toBe(false);
    });

    it('docks the word field above the keyboard on a phone, with the reason in the dock', () => {
        viewport(24);
        renderBoard({ turnOrder: ['ada', 'ines'], turnPlayerId: 'ines' });

        const dock = document.querySelector<HTMLElement>(
            '[data-slot="keyboard-dock"]',
        ) as HTMLElement;
        const field = within(dock).getByRole('textbox', {
            name: 'Guess the whole word (+5 pts, −1 life if wrong)',
        });
        const keyboard = within(dock).getByRole('group', { name: 'Letters' });

        expect(within(dock).getByText("Inès's turn")).toBeTruthy();
        expect(
            field.compareDocumentPosition(keyboard) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});

describe('HangmanBoard for an observer', () => {
    it('shows the word and the gallows without the letters or the guess field', () => {
        viewport(80);
        renderBoard({}, true);

        expect(screen.queryByRole('group', { name: 'Letters' })).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
        expect(
            document.querySelector('[data-slot="hangman-board"]'),
        ).not.toBeNull();
    });
});
