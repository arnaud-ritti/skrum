import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrawingOp, GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { DrawBoard } from './draw-board';
import { RoomProvider, type RoomContextValue } from './room-context';

vi.mock('./game-layout', () => ({
    useHasRightColumn: () => true,
    useStageFooter: () => null,
}));

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('./drawing-canvas', () => ({
    DrawingCanvas: ({
        input,
    }: {
        input: {
            onCommit: (op: DrawingOp, clientOpId: string) => void;
        } | null;
    }) =>
        input === null ? null : (
            <button
                type="button"
                onClick={() =>
                    input.onCommit(
                        { type: 'fill', color: 'red', x: 5, y: 5 },
                        'op-new',
                    )
                }
            >
                draw a stroke
            </button>
        ),
}));

vi.mock('@/hooks/use-stroke-whispers', () => ({
    useStrokeWhispers: () => () => undefined,
}));

const now = new Date('2026-10-03T10:00:00Z');

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    mocks.request.mockReset();
    mocks.request.mockResolvedValue(undefined);
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
        run: <T,>(mutation: Promise<T>) => mutation,
        apply: vi.fn(),
        dispatch: vi.fn(),
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

    return ctx;
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

const stroke: DrawingOp = {
    type: 'stroke',
    color: 'black',
    size: 10,
    points: [
        [1, 2],
        [3, 4],
    ],
};

function button(name: RegExp | string): HTMLButtonElement {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

describe('DrawBoard, a new word', () => {
    it('offers the drawer one other word, and takes it', async () => {
        mocks.request.mockResolvedValue({
            roundId: 'round',
            word: 'ROCKET',
            mask: [null, null, null, null, null, null],
            maxHints: 2,
            wordChangesLeft: 0,
        });

        const ctx = renderBoard('drawer', { wordChangesLeft: 1 });

        await act(async () => {
            fireEvent.click(button('New word (1)'));
        });

        expect(String(mocks.request.mock.calls[0][0].url)).toContain(
            '/rounds/round/word-changes',
        );
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'word.changed',
            change: {
                roundId: 'round',
                mask: [null, null, null, null, null, null],
                maxHints: 2,
            },
        });
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { word: 'ROCKET', wordChangesLeft: 0 },
        });
    });

    it('is spent once used', () => {
        renderBoard('drawer', { wordChangesLeft: 0 });

        expect(button('New word (0)').disabled).toBe(true);
    });

    it('is closed once someone found, and says why', () => {
        renderBoard('drawer', {
            wordChangesLeft: 1,
            guessersTotal: 3,
            finders: [{ playerId: 'ada', seconds: 9, points: 10 }],
        });

        expect(button('New word (1)').disabled).toBe(true);
        expect(
            screen.getByRole('group', {
                name: 'Someone has already found the word.',
            }),
        ).toBeTruthy();
    });

    it('is not offered to the guessers', () => {
        renderBoard('guesser', { wordChangesLeft: 1 });

        expect(screen.queryByRole('button', { name: /New word/ })).toBeNull();
    });
});

describe('DrawBoard, redo', () => {
    it('redoes what the drawer undid, as a new operation', async () => {
        mocks.request.mockResolvedValue({ roundId: 'round', count: 0 });

        renderBoard('drawer', { drawing: [stroke] });

        expect(button('Redo').disabled).toBe(true);

        await act(async () => {
            fireEvent.click(button('Undo'));
        });

        expect(button('Redo').disabled).toBe(false);

        await act(async () => {
            fireEvent.click(button('Redo'));
        });

        const body = mocks.request.mock.calls[1][1] as {
            op: DrawingOp;
            client_op_id: string;
        };

        expect(body.op).toEqual(stroke);
        expect(body.client_op_id).not.toBe('');
        expect(button('Redo').disabled).toBe(true);
    });

    it('redoes outside a secure context, where the browser has no crypto.randomUUID', async () => {
        mocks.request.mockResolvedValue({ roundId: 'round', count: 0 });
        vi.stubGlobal('crypto', {
            getRandomValues: crypto.getRandomValues.bind(crypto),
        });

        try {
            renderBoard('drawer', { drawing: [stroke] });

            await act(async () => {
                fireEvent.click(button('Undo'));
            });

            await act(async () => {
                fireEvent.click(button('Redo'));
            });

            const body = mocks.request.mock.calls[1][1] as {
                client_op_id: string;
            };

            expect(body.client_op_id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('redoes each operation of two quick undos, in reverse order', async () => {
        const fill: DrawingOp = { type: 'fill', color: 'red', x: 5, y: 5 };

        mocks.request
            .mockResolvedValueOnce({ roundId: 'round', count: 1 })
            .mockResolvedValueOnce({ roundId: 'round', count: 0 })
            .mockResolvedValue(undefined);

        renderBoard('drawer', { drawing: [stroke, fill] });

        await act(async () => {
            fireEvent.click(button('Undo'));
            fireEvent.click(button('Undo'));
        });

        await act(async () => {
            fireEvent.click(button('Redo'));
        });

        await act(async () => {
            fireEvent.click(button('Redo'));
        });

        const redone = mocks.request.mock.calls
            .slice(2)
            .map((call) => (call[1] as { op: DrawingOp }).op);

        expect(redone).toEqual([stroke, fill]);
    });

    it('forgets what was undone once the drawer draws again', async () => {
        mocks.request.mockResolvedValue({ roundId: 'round', count: 0 });

        renderBoard('drawer', { drawing: [stroke] });

        await act(async () => {
            fireEvent.click(button('Undo'));
        });

        expect(button('Redo').disabled).toBe(false);

        await act(async () => {
            fireEvent.click(button('draw a stroke'));
        });

        expect(button('Redo').disabled).toBe(true);
    });
});

describe('DrawBoard, the word card', () => {
    it('shows the drawer their word in capitals, the other word beside it', () => {
        renderBoard('drawer', { word: 'lantern' });

        const card = document.querySelector('[data-slot="word-card"]');
        const word = screen.getByText('lantern');

        expect(word.classList.contains('uppercase')).toBe(true);
        expect(card?.classList.contains('flex-nowrap')).toBe(true);
        expect(card?.contains(button('New word (1)'))).toBe(true);
    });
});

describe('DrawBoard, a finder', () => {
    it('shows the word they found above the drawing', () => {
        renderBoard('guesser', {
            word: 'ROCKET',
            guessersTotal: 3,
            finders: [{ playerId: 'guesser', seconds: 9, points: 10 }],
        });

        expect(screen.getByText('ROCKET')).toBeTruthy();
        expect(screen.getByText('You found it!')).toBeTruthy();
    });
});
