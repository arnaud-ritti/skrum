import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { DrawBoard } from './draw-board';
import { RoomProvider, type RoomContextValue } from './room-context';

vi.mock('./game-layout', () => ({
    useHasRightColumn: () => true,
    useStageFooter: () => null,
}));

vi.mock('./drawing-canvas', () => ({
    DrawingCanvas: () => null,
}));

vi.mock('@/hooks/use-stroke-whispers', () => ({
    useStrokeWhispers: () => () => undefined,
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
        presence: null,
        serverOffset: 0,
        run: vi.fn(),
        apply: vi.fn(),
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <DrawBoard
                round={
                    {
                        id: 'round',
                        game: 'draw',
                        leaderPlayerId: 'drawer',
                        startedAt: new Date(now.getTime() - 8000).toISOString(),
                        hintSeconds: 20,
                        maxHints: 3,
                        mask: [null, null, null, null, null, null],
                        word: me === 'drawer' ? 'BANANA' : undefined,
                        drawing: [],
                        committedOpIds: [],
                        guesses: [],
                        ...round,
                    } as GameRound
                }
            />
        </RoomProvider>,
    );
}

describe('DrawBoard auto hints', () => {
    it('shows a guesser when the next letter comes, under the mask', () => {
        renderBoard('guesser');

        expect(screen.getByText('next letter in 0:12')).toBeTruthy();
    });

    it('shows the drawer when the next letter comes, under the word', () => {
        renderBoard('drawer');

        expect(screen.getByText('next letter in 0:12')).toBeTruthy();
        expect(screen.getByText('BANANA')).toBeTruthy();
    });

    it('shows no countdown once every hint is shown', () => {
        renderBoard('guesser', { mask: ['b', null, 'n', null, 'n', null] });

        expect(screen.queryByText(/next letter/)).toBeNull();
    });
});
