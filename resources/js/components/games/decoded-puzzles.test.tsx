import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
    GameHistoryRound,
    GameKind,
    GameRound,
    GameSnapshot,
} from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { DecodedPuzzles } from './decoded-puzzles';
import { RoomProvider, type RoomContextValue } from './room-context';

function ended(
    number: number,
    overrides: Partial<GameHistoryRound> = {},
): GameHistoryRound {
    return {
        id: `round-${number}`,
        game: 'decoded',
        outcome: 'guessed',
        word: `Word ${number}`,
        question: null,
        leaderPlayerId: 'ada',
        leaderName: 'Ada',
        winnerPlayerId: 'ines',
        winnerName: 'Inès',
        endedAt: '2026-10-03T10:00:00Z',
        number,
        roundsTotal: 8,
        clue: ['🦁', '👑'],
        ...overrides,
    };
}

function renderPuzzles(
    history: GameHistoryRound[],
    round: Partial<GameRound> & { game?: GameKind },
) {
    const ctx = {
        snapshot: {
            room: { id: 'room', game: 'decoded' },
            history,
            round: { id: 'now', game: 'decoded', clue: [], ...round },
        } as unknown as GameSnapshot,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <DecodedPuzzles />
        </RoomProvider>,
    );
}

function rows(): HTMLElement[] {
    return within(screen.getByRole('list')).getAllByRole('listitem');
}

describe('DecodedPuzzles', () => {
    it('shows the current and the coming puzzles at the first round of a numbered game', () => {
        renderPuzzles([], { number: 1, roundsTotal: 3 });

        expect(screen.getByRole('heading', { name: 'Puzzles' })).toBeTruthy();
        expect(screen.getByText('1 / 3')).toBeTruthy();
        expect(rows()).toHaveLength(3);
        expect(rows()[0].getAttribute('aria-current')).toBe('step');
        expect(rows()[1].textContent).toContain('Puzzle 2');
        expect(rows()[1].className).toContain('border-dashed');
        expect(rows()[2].textContent).toContain('Puzzle 3');
    });

    it('lists the done puzzles with their clue, word and finder at the fourth of eight', () => {
        renderPuzzles([ended(3), ended(2), ended(1)], {
            number: 4,
            roundsTotal: 8,
            clue: ['🧊'],
        });

        expect(screen.getByText('4 / 8')).toBeTruthy();
        expect(rows()).toHaveLength(8);

        const [first] = rows();

        expect(within(first).getByText('Word 1')).toBeTruthy();
        expect(within(first).getByText('Found by Inès')).toBeTruthy();
        expect(
            within(first).getByRole('img', { name: 'Clue: 🦁 👑' }),
        ).toBeTruthy();

        const playing = rows()[3];

        expect(playing.getAttribute('aria-current')).toBe('step');
        expect(within(playing).getByText('Puzzle in progress')).toBeTruthy();
        expect(
            within(playing).getByRole('img', { name: 'Clue: 🧊' }),
        ).toBeTruthy();
        expect(rows()[4].textContent).not.toContain('🦁');
    });

    it('counts an endless game without a total and no coming puzzle', () => {
        renderPuzzles([ended(1, { roundsTotal: null })], {
            number: 2,
            roundsTotal: null,
        });

        expect(
            screen.getByRole('heading', { name: 'Puzzles' }).nextElementSibling
                ?.textContent,
        ).toBe('2');
        expect(rows()).toHaveLength(2);
    });

    it('says when a puzzle was not found', () => {
        renderPuzzles(
            [
                ended(1, {
                    outcome: 'timed_out',
                    winnerName: null,
                    winnerPlayerId: null,
                }),
            ],
            { number: 2, roundsTotal: 3 },
        );

        expect(within(rows()[0]).getByText('Not found')).toBeTruthy();
    });

    it('shows nothing for another game', () => {
        renderPuzzles([], { game: 'hangman', number: 1, roundsTotal: 3 });

        expect(
            document.querySelector('[data-slot="decoded-puzzles"]'),
        ).toBeNull();
    });
});
