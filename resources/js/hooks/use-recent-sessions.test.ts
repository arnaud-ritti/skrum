import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    RecentSessionsFreshMs,
    useRecentSessions,
} from '@/hooks/use-recent-sessions';
import type { RecentSession } from '@/hooks/use-recent-sessions';
import { retroRequest } from '@/lib/retro/api';

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(),
}));

const request = vi.mocked(retroRequest);

const sprint: RecentSession = {
    kind: 'retro',
    id: 'r1',
    title: 'Sprint 42',
    team: { id: 't1', name: 'Atlas' },
    url: '/retros/r1',
    updatedAt: '2026-10-01T10:00:00+00:00',
    live: true,
};

async function settle(): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
    });
}

function setup(open: boolean) {
    return renderHook(
        (props: { open: boolean }) => useRecentSessions(props.open),
        { initialProps: { open } },
    );
}

describe('useRecentSessions', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        request.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it('asks nothing while the palette has never been opened', async () => {
        setup(false);
        await settle();

        expect(request).not.toHaveBeenCalled();
    });

    it('reads the sessions once when the palette first opens', async () => {
        request.mockResolvedValue({ sessions: [sprint] } as never);
        const { rerender, result } = setup(false);

        rerender({ open: true });
        await settle();

        expect(request).toHaveBeenCalledTimes(1);
        expect(
            String((request.mock.calls[0][0] as { url: string }).url),
        ).toContain('/recent-sessions');
        expect(result.current.sessions).toEqual([sprint]);
        expect(result.current.loading).toBe(false);
    });

    it('asks again on a later opening only after thirty seconds', async () => {
        request.mockResolvedValue({ sessions: [sprint] } as never);
        const { rerender } = setup(true);
        await settle();

        rerender({ open: false });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(RecentSessionsFreshMs - 1);
        });
        rerender({ open: true });
        await settle();
        expect(request).toHaveBeenCalledTimes(1);

        rerender({ open: false });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        rerender({ open: true });
        await settle();
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('reports a failure, keeps what it had and asks again at the next opening', async () => {
        request.mockRejectedValue(new Error('offline'));
        const { rerender, result } = setup(true);
        await settle();

        expect(result.current.failed).toBe(true);
        expect(result.current.sessions).toEqual([]);

        rerender({ open: false });
        rerender({ open: true });
        await settle();

        expect(request).toHaveBeenCalledTimes(2);
    });
});
