import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GameLayout } from './game-layout';
import { HangmanBoard } from './hangman-board';
import { RoomProvider, type RoomContextValue } from './room-context';

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
} as unknown as GameRound;

function renderBoard() {
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'hangman' },
            me: { playerId: 'ada' },
            players: [],
        },
    } as unknown as RoomContextValue;

    return renderWithProviders(
        <RoomProvider value={ctx}>
            <GameLayout stage={<HangmanBoard round={round} />} />
        </RoomProvider>,
    );
}

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
                name: 'Last letters',
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
});
