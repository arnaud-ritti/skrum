import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardContextValue } from '@/components/retro/board-context';
import {
    useRotiFacilitation,
    useRotiNudgeToast,
} from '@/components/retro/roti-facilitation';
import type { PresenceMember } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const carol: PresenceMember = {
    id: 'carol',
    name: 'Carol Guest',
    avatarUrl: '/c.svg',
    isGuest: true,
};

function rotiBoard(roti = {}, viewer = {}) {
    return retroSnapshot({
        retro: { phase: 'roti' },
        viewer,
        roti: {
            myScore: null,
            respondents: 0,
            voterIds: [],
            canVote: true,
            revealed: false,
            results: null,
            ...roti,
        },
    });
}

function Tools() {
    const { nudge, reveal } = useRotiFacilitation();

    return (
        <>
            {[nudge, reveal].map(
                (action) =>
                    action && (
                        <button
                            key={action.id}
                            type="button"
                            disabled={action.disabled}
                            onClick={action.onSelect}
                        >
                            {action.label}
                        </button>
                    ),
            )}
        </>
    );
}

function NudgeProbe() {
    const nudged = useRotiNudgeToast();

    return <span data-testid="probe" data-nudged={nudged} />;
}

function withNudges(ctx: BoardContextValue) {
    const listeners = new Set<() => void>();

    return {
        ctx: {
            ...ctx,
            subscribeRotiNudges: (listener: () => void) => {
                listeners.add(listener);

                return () => {
                    listeners.delete(listener);
                };
            },
        },
        nudge: () => act(() => listeners.forEach((listener) => listener())),
    };
}

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
    toast.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useRotiFacilitation', () => {
    it('counts the connected people who have not voted, guests included, never the facilitator', () => {
        const board = rotiBoard({ voterIds: ['bob'] });
        const ctx = boardContext(board);

        renderInBoard(
            <Tools />,
            boardContext(board, { online: [...ctx.online, carol] }),
        );

        expect(
            screen.getByRole('button', { name: 'Nudge the last one' }),
        ).toBeTruthy();
    });

    it('names how many are left when several have not voted', () => {
        const board = rotiBoard();
        const ctx = boardContext(board);

        renderInBoard(
            <Tools />,
            boardContext(board, { online: [...ctx.online, carol] }),
        );

        expect(
            screen.getByRole('button', { name: 'Nudge the last 2' }),
        ).toBeTruthy();
    });

    it('disables the nudge once everyone has voted', () => {
        renderInBoard(
            <Tools />,
            boardContext(rotiBoard({ voterIds: ['bob'] })),
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Nudge the last 0',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('sends the nudge and disables it for 30 seconds', async () => {
        vi.useFakeTimers();
        renderInBoard(<Tools />, boardContext(rotiBoard()));
        const button = () =>
            screen.getByRole('button', {
                name: 'Nudge the last one',
            }) as HTMLButtonElement;

        await act(async () => {
            fireEvent.click(button());
        });

        expect(retroRequest.mock.calls[0][0]).toMatchObject({
            method: 'post',
            url: '/retros/retro-1/roti/nudges',
        });
        expect(button().disabled).toBe(true);

        await act(async () => {
            vi.advanceTimersByTime(29_000);
        });

        expect(button().disabled).toBe(true);

        await act(async () => {
            vi.advanceTimersByTime(1_000);
        });

        expect(button().disabled).toBe(false);
    });

    it('keeps the nudge available when the server refuses it', async () => {
        retroRequest.mockRejectedValue(new Error('429'));
        renderInBoard(<Tools />, boardContext(rotiBoard()));
        const button = () =>
            screen.getByRole('button', {
                name: 'Nudge the last one',
            }) as HTMLButtonElement;

        fireEvent.click(button());

        await waitFor(() => expect(button().disabled).toBe(false));
        expect(retroRequest).toHaveBeenCalledTimes(1);
    });

    it('reveals the ROTI and refetches the board', async () => {
        const { ctx } = renderInBoard(<Tools />, boardContext(rotiBoard()));

        fireEvent.click(screen.getByRole('button', { name: 'Reveal ROTI' }));

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(retroRequest.mock.calls[0][0]).toMatchObject({
            method: 'put',
            url: '/retros/retro-1/roti/reveal',
        });
    });

    it('offers neither once the ROTI is revealed', () => {
        renderInBoard(
            <Tools />,
            boardContext(rotiBoard({ revealed: true, canVote: false })),
        );

        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('useRotiNudgeToast', () => {
    it('toasts and pulses a participant who has not voted', () => {
        const { ctx, nudge } = withNudges(
            boardContext(rotiBoard({}, { isFacilitator: false })),
        );

        renderInBoard(<NudgeProbe />, ctx);
        nudge();

        expect(toast).toHaveBeenCalledWith('Your ROTI vote is awaited');
        expect(screen.getByTestId('probe').dataset.nudged).toBe('true');
    });

    it('stops the pulse after one run', () => {
        vi.useFakeTimers();
        const { ctx, nudge } = withNudges(
            boardContext(rotiBoard({}, { isFacilitator: false })),
        );

        renderInBoard(<NudgeProbe />, ctx);
        nudge();
        act(() => {
            vi.advanceTimersByTime(2_400);
        });

        expect(screen.getByTestId('probe').dataset.nudged).toBe('false');
    });

    it('leaves alone a participant who has voted', () => {
        const { ctx, nudge } = withNudges(
            boardContext(
                rotiBoard(
                    { myScore: 4, voterIds: ['me'] },
                    { isFacilitator: false },
                ),
            ),
        );

        renderInBoard(<NudgeProbe />, ctx);
        nudge();

        expect(toast).not.toHaveBeenCalled();
        expect(screen.getByTestId('probe').dataset.nudged).toBe('false');
    });

    it('leaves alone the facilitator', () => {
        const { ctx, nudge } = withNudges(boardContext(rotiBoard()));

        renderInBoard(<NudgeProbe />, ctx);
        nudge();

        expect(toast).not.toHaveBeenCalled();
    });
});
