import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchDelayMs, useGlobalSearch } from '@/hooks/use-global-search';
import type { SearchResult } from '@/hooks/use-global-search';
import { retroRequest } from '@/lib/retro/api';

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(),
}));

const request = vi.mocked(retroRequest);

const kraken: SearchResult = {
    kind: 'retro',
    id: 'r1',
    title: 'Kraken retro',
    team: { id: 't1', name: 'Atlas' },
    url: '/retros/r1',
};

async function wait(ms: number): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

function setup(query: string) {
    return renderHook(
        (props: { query: string }) => useGlobalSearch(props.query),
        { initialProps: { query } },
    );
}

describe('useGlobalSearch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        request.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it('does not ask the server under two characters or for spaces', async () => {
        const { rerender } = setup('k');
        await wait(SearchDelayMs * 2);
        rerender({ query: '   ' });
        await wait(SearchDelayMs * 2);

        expect(request).not.toHaveBeenCalled();
    });

    it('waits for a pause in typing, then asks once with the trimmed term', async () => {
        request.mockResolvedValue({ results: [kraken] } as never);
        const { rerender, result } = setup('kr');
        rerender({ query: 'kra' });
        rerender({ query: ' kraken ' });

        await wait(SearchDelayMs - 1);
        expect(request).not.toHaveBeenCalled();

        await wait(1);
        expect(request).toHaveBeenCalledTimes(1);
        expect(
            String((request.mock.calls[0][0] as { url: string }).url),
        ).toContain('q=kraken');
        expect(result.current.results).toEqual([kraken]);
        expect(result.current.term).toBe('kraken');
        expect(result.current.loading).toBe(false);
    });

    it('drops the answer to an older term', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        request.mockImplementationOnce(
            () => new Promise((resolve) => (resolveFirst = resolve)) as never,
        );
        request.mockResolvedValueOnce({ results: [] } as never);
        const { rerender, result } = setup('kraken');
        await wait(SearchDelayMs);

        rerender({ query: 'atlas' });
        await wait(SearchDelayMs);
        await act(async () => resolveFirst({ results: [kraken] }));

        expect(result.current.results).toEqual([]);
        expect(result.current.term).toBe('atlas');
    });

    it('empties the results when the field is cleared', async () => {
        request.mockResolvedValue({ results: [kraken] } as never);
        const { rerender, result } = setup('kraken');
        await wait(SearchDelayMs);

        rerender({ query: '' });
        await wait(0);

        expect(result.current.results).toEqual([]);
        expect(result.current.loading).toBe(false);
    });

    it('reports a failure without throwing and keeps no stale result', async () => {
        request.mockRejectedValue(new Error('offline'));
        const { result } = setup('kraken');
        await wait(SearchDelayMs);

        expect(result.current.failed).toBe(true);
        expect(result.current.results).toEqual([]);
    });
});
