import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '@/components/poker/game-context';
import { useRoundActions } from '@/components/poker/use-round-actions';
import {
    pokerRound,
    pokerSnapshot,
    pokerTask,
    renderInRoom,
} from '@/test/poker-room';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function Harness() {
    const actions = useRoundActions();

    return (
        <>
            <button type="button" onClick={() => void actions.validate('5')}>
                {actions.busy ? 'busy' : 'validate'}
            </button>
            <button type="button" onClick={() => actions.chooseEstimate('8')}>
                choose 8
            </button>
            <output data-estimate={actions.estimate}>
                {actions.estimateCards.join(',')}
            </output>
        </>
    );
}

function estimate(): string | null {
    return screen.getByRole('status').getAttribute('data-estimate');
}

const revealed = pokerRound({ revealedAt: '2026-10-02T09:01:00Z' });

/** The room's `run`: a refused request resolves to undefined, its error shown. */
function failing(onError: (error: unknown) => void) {
    return {
        run: async <T,>(mutation: Promise<T>): Promise<T | undefined> => {
            try {
                return await mutation;
            } catch (error) {
                onError(error);

                return undefined;
            }
        },
    };
}

async function validate() {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'validate' }));
    });
}

beforeEach(() => {
    mocks.request.mockReset();
});

describe('useRoundActions, validate', () => {
    it('saves the estimate, then opens the next task without an estimate', async () => {
        const saved = pokerTask('t1', 'Login page', { estimate: '5' });

        mocks.request.mockResolvedValueOnce(saved).mockResolvedValueOnce({});

        const { ctx } = renderInRoom(
            <Harness />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        await validate();

        expect(mocks.request).toHaveBeenCalledTimes(2);
        expect(mocks.request.mock.calls[0][0].url).toContain('/tasks/t1/');
        expect(mocks.request.mock.calls[0][1]).toEqual({ value: '5' });
        expect(mocks.request.mock.calls[1][1]).toEqual({ task_id: 't2' });
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'task.upsert',
            task: saved,
        });
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });

    it('only saves when every other task has an estimate', async () => {
        mocks.request.mockResolvedValueOnce(
            pokerTask('t1', 'Login page', { estimate: '5' }),
        );

        const { ctx } = renderInRoom(
            <Harness />,
            pokerSnapshot({
                tasks: [pokerTask('t1', 'Login page')],
                current: { taskId: 't1', round: revealed },
            }),
        );

        await validate();

        expect(mocks.request).toHaveBeenCalledTimes(1);
        expect(ctx.apply).toHaveBeenCalledTimes(1);
        expect(ctx.refetch).not.toHaveBeenCalled();
    });

    it('keeps the estimate saved and shows the error when the move fails', async () => {
        const saved = pokerTask('t1', 'Login page', { estimate: '5' });
        const onError = vi.fn();

        mocks.request
            .mockResolvedValueOnce(saved)
            .mockRejectedValueOnce(new Error('refused'));

        const { ctx } = renderInRoom(
            <Harness />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
            failing(onError),
        );

        await validate();

        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'task.upsert',
            task: saved,
        });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(ctx.refetch).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'validate' })).toBeTruthy();
    });

    it('does not move on when the estimate is refused', async () => {
        const onError = vi.fn();

        mocks.request.mockRejectedValueOnce(new Error('refused'));

        const { ctx } = renderInRoom(
            <Harness />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
            failing(onError),
        );

        await validate();

        expect(mocks.request).toHaveBeenCalledTimes(1);
        expect(ctx.apply).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
    });
});

describe('useRoundActions, the final estimate', () => {
    const withResult = pokerRound({
        revealedAt: '2026-10-02T09:01:00Z',
        result: {
            average: 5.5,
            distribution: [
                { value: '3', count: 1 },
                { value: '8', count: 1 },
            ],
            mode: ['3', '8'],
            consensus: false,
            nearestCard: '5',
        },
    });

    it('proposes the nearest card among the cards of the deck, without "?" and the break', () => {
        renderInRoom(
            <Harness />,
            pokerSnapshot({ current: { taskId: 't1', round: withResult } }),
        );

        expect(estimate()).toBe('5');
        expect(screen.getByRole('status').textContent).toBe('1,2,3,5,8');
    });

    it('proposes the saved estimate first, and keeps it among the cards when it left the deck', () => {
        renderInRoom(
            <Harness />,
            pokerSnapshot({
                tasks: [pokerTask('t1', 'Login page', { estimate: '13' })],
                current: { taskId: 't1', round: withResult },
            }),
        );

        expect(estimate()).toBe('13');
        expect(screen.getByRole('status').textContent).toBe('1,2,3,5,8,13');
    });

    it('proposes nothing while no card can be counted', () => {
        renderInRoom(
            <Harness />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        expect(estimate()).toBe('');
    });

    it('keeps the choice of the facilitator for the round it was made on', () => {
        const { ctx, rerender } = renderInRoom(
            <Harness />,
            pokerSnapshot({ current: { taskId: 't1', round: withResult } }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'choose 8' }));

        expect(estimate()).toBe('8');

        rerender(
            <GameProvider
                value={{
                    ...ctx,
                    snapshot: pokerSnapshot({
                        current: {
                            taskId: 't1',
                            round: { ...withResult, id: 'round-2', number: 2 },
                        },
                    }),
                }}
            >
                <Harness />
            </GameProvider>,
        );

        expect(estimate()).toBe('5');
    });
});
