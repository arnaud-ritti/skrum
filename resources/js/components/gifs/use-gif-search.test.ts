import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gifStatusOf, useGifSearch } from '@/components/gifs/use-gif-search';
import type { GameGifSearchResult } from '@/lib/games/types';
import { RetroRequestError } from '@/lib/retro/api';

function httpError(status: number): RetroRequestError {
    return Object.assign(Object.create(RetroRequestError.prototype), {
        status,
    });
}

describe('gifStatusOf', () => {
    it('tells a rate limit from a switched-off provider from a failure', () => {
        expect(gifStatusOf(httpError(429))).toBe('rate_limited');
        expect(gifStatusOf(httpError(404))).toBe('disabled');
        expect(gifStatusOf(httpError(403))).toBe('disabled');
        expect(gifStatusOf(httpError(500))).toBe('error');
        expect(gifStatusOf(new Error('network'))).toBe('error');
    });
});

function gif(id: string): GameGifSearchResult {
    return { id, previewUrl: `/gifs/${id}/preview`, width: 200, height: 100 };
}

describe('useGifSearch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('searches the empty query on open, after the debounce', async () => {
        const search = vi.fn().mockResolvedValue({ gifs: [gif('a')] });
        const { result } = renderHook(() => useGifSearch(search, true));

        expect(result.current.status).toBe('loading');
        expect(search).not.toHaveBeenCalled();

        await act(() => vi.advanceTimersByTimeAsync(300));

        expect(search).toHaveBeenCalledExactlyOnceWith('');
        expect(result.current.status).toBe('idle');
        expect(result.current.results).toEqual([gif('a')]);
    });

    it('does not search while closed', async () => {
        const search = vi.fn().mockResolvedValue({ gifs: [] });
        renderHook(() => useGifSearch(search, false));

        await act(() => vi.advanceTimersByTimeAsync(300));

        expect(search).not.toHaveBeenCalled();
    });

    it('reports an empty answer and a failed one, and retries', async () => {
        const search = vi
            .fn()
            .mockResolvedValueOnce({ gifs: [] })
            .mockRejectedValueOnce(httpError(429))
            .mockResolvedValueOnce({ gifs: [gif('b')] });
        const { result } = renderHook(() => useGifSearch(search, true));

        await act(() => vi.advanceTimersByTimeAsync(300));
        expect(result.current.status).toBe('empty');

        act(() => result.current.setQuery('party'));
        expect(result.current.status).toBe('loading');

        await act(() => vi.advanceTimersByTimeAsync(300));
        expect(result.current.status).toBe('rate_limited');

        act(() => result.current.retry());
        await act(() => vi.advanceTimersByTimeAsync(300));

        expect(search).toHaveBeenLastCalledWith('party');
        expect(result.current.status).toBe('idle');
    });

    it('drops the answer of a query that is no longer the latest', async () => {
        let answerFirst: (value: {
            gifs: GameGifSearchResult[];
        }) => void = () => {};
        const search = vi
            .fn()
            .mockReturnValueOnce(
                new Promise<{ gifs: GameGifSearchResult[] }>((resolve) => {
                    answerFirst = resolve;
                }),
            )
            .mockResolvedValueOnce({ gifs: [gif('late')] });
        const { result } = renderHook(() => useGifSearch(search, true));

        await act(() => vi.advanceTimersByTimeAsync(300));
        act(() => result.current.setQuery('late'));
        await act(() => vi.advanceTimersByTimeAsync(300));
        await act(async () => answerFirst({ gifs: [gif('early')] }));

        expect(result.current.results).toEqual([gif('late')]);
    });
});
