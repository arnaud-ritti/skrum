import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EstimateConflict } from '@/components/poker/estimate-conflict';
import type { PokerEstimateConflict } from '@/lib/poker/types';
import { pokerSnapshot, pokerTask, renderInRoom } from '@/test/poker-room';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

const task = pokerTask('t1', 'Login page', { estimate: '5' });

function conflict(
    value: PokerEstimateConflict,
    me: { isFacilitator?: boolean } = {},
) {
    return renderInRoom(
        <EstimateConflict task={task} conflict={value} source="Jira" />,
        pokerSnapshot({ me }),
    );
}

function button(name: string): HTMLButtonElement {
    return screen.getByRole<HTMLButtonElement>('button', { name });
}

beforeEach(() => {
    mocks.request.mockReset();
});

describe('EstimateConflict', () => {
    it('announces the estimate of the tracker and offers both ways out to the facilitator', () => {
        conflict({ sourceEstimate: '8', matchingCard: '8' });

        expect(screen.getByRole('status').textContent).toContain(
            'Changed in Jira to 8',
        );
        expect(button('Keep skrum estimate').disabled).toBe(false);
        expect(button('Use Jira estimate').disabled).toBe(false);
        expect(screen.queryByText('8 is not in this deck.')).toBeNull();
    });

    it('tells a player without offering a decision', () => {
        conflict(
            { sourceEstimate: '8', matchingCard: '8' },
            { isFacilitator: false },
        );

        expect(screen.getByText('Changed in Jira to 8')).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('cannot take an estimate the deck does not hold, and says so', () => {
        conflict({ sourceEstimate: '7', matchingCard: null });

        expect(button('Use Jira estimate').disabled).toBe(true);
        expect(button('Keep skrum estimate').disabled).toBe(false);
        expect(screen.getByText('7 is not in this deck.')).toBeTruthy();
    });

    it.each([
        ['Keep skrum estimate', 'keepSkrum'],
        ['Use Jira estimate', 'useSource'],
    ])(
        '"%s" sends the decision and applies the task',
        async (name, resolution) => {
            const resolved = { ...task, estimate: '8' };
            mocks.request.mockResolvedValue(resolved);
            const { ctx } = conflict({
                sourceEstimate: '8',
                matchingCard: '8',
            });

            await act(async () => {
                fireEvent.click(button(name));
            });

            expect(mocks.request.mock.calls[0][0].url).toBe(
                '/poker/game-1/tasks/t1/estimate-conflict',
            );
            expect(mocks.request.mock.calls[0][1]).toEqual({ resolution });
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'task.upsert',
                task: resolved,
            });
        },
    );

    it('locks both buttons while the decision is sent and frees them when it is refused', async () => {
        let settle: (value: undefined) => void = () => {};
        mocks.request.mockReturnValue(
            new Promise<undefined>((resolve) => {
                settle = resolve;
            }),
        );
        const { ctx } = conflict({ sourceEstimate: '8', matchingCard: '8' });

        fireEvent.click(button('Keep skrum estimate'));

        expect(button('Keep skrum estimate').disabled).toBe(true);
        expect(button('Use Jira estimate').disabled).toBe(true);

        await act(async () => {
            settle(undefined);
        });

        expect(button('Keep skrum estimate').disabled).toBe(false);
        expect(ctx.apply).not.toHaveBeenCalled();
    });
});
