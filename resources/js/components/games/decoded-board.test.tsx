import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { DecodedBoard } from './decoded-board';
import { RoomProvider, type RoomContextValue } from './room-context';

vi.mock('./game-layout', () => ({
    useHasRightColumn: () => true,
}));

const now = new Date('2026-10-03T10:00:00Z');

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
});

afterEach(() => {
    vi.useRealTimers();
});

function renderBoard(me: string, round: Partial<GameRound> = {}) {
    const ctx = {
        snapshot: {
            room: { id: 'room' },
            me: { playerId: me },
            players: [],
        },
        serverOffset: 0,
        run: vi.fn(),
        apply: vi.fn(),
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <DecodedBoard
                round={
                    {
                        id: 'round',
                        game: 'decoded',
                        leaderPlayerId: 'leader',
                        startedAt: new Date(now.getTime() - 8000).toISOString(),
                        hintSeconds: 20,
                        maxHints: 3,
                        mask: [null, null, null, null, null, null],
                        word: me === 'leader' ? 'BANANA' : undefined,
                        clue: [],
                        guesses: [],
                        ...round,
                    } as GameRound
                }
            />
        </RoomProvider>,
    );
}

describe('DecodedBoard auto hints', () => {
    it('shows a guesser when the next letter comes', () => {
        renderBoard('guesser');

        expect(screen.getByText('next letter in 0:12')).toBeTruthy();
    });

    it('shows the leader when the next letter comes, beside the hint button', () => {
        renderBoard('leader');

        expect(screen.getByText('next letter in 0:12')).toBeTruthy();
    });

    it('shows no countdown without auto hints', () => {
        renderBoard('guesser', { hintSeconds: null });

        expect(screen.queryByText(/next letter/)).toBeNull();
    });
});
