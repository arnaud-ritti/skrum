import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameKind, GameRound, WordTheme } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoundInfo } from './round-info';

function renderInfo(
    round: Partial<GameRound> & { game: GameKind },
    wordThemes: WordTheme[] = [],
) {
    const ctx = {
        snapshot: { room: { id: 'room', settings: { wordThemes } } },
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <RoundInfo round={round as GameRound} />
        </RoomProvider>,
    );
}

function line(): string | null | undefined {
    return document.querySelector('[data-slot="round-info"]')?.textContent;
}

describe('RoundInfo', () => {
    it('numbers the round within its game, with the one theme chosen', () => {
        renderInfo({ game: 'hangman', number: 2, roundsTotal: 3 }, ['work']);

        expect(line()).toBe('Round 2 of 3 · Theme: Team & tech');
    });

    it('counts an endless game without a total, and names no theme among several', () => {
        renderInfo({ game: 'decoded', number: 7, roundsTotal: null }, [
            'work',
            'food',
        ]);

        expect(screen.getByText('Round 7')).toBeTruthy();
    });

    it('names no theme for a game without words', () => {
        renderInfo({ game: 'gif', number: 1, roundsTotal: 5 }, ['food']);

        expect(line()).toBe('Round 1 of 5');
    });

    it('says nothing for a round from before the numbers', () => {
        renderInfo({ game: 'hangman', number: null, roundsTotal: null });

        expect(document.querySelector('[data-slot="round-info"]')).toBeNull();
    });
});
