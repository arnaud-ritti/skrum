import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from '@/hooks/use-now';

describe('useNow', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    });

    afterEach(() => vi.useRealTimers());

    it('moves on every minute', () => {
        const { result } = renderHook(() => useNow());

        expect(result.current).toBe(Date.parse('2026-09-30T10:00:00Z'));

        act(() => {
            vi.advanceTimersByTime(60_000);
        });

        expect(result.current).toBe(Date.parse('2026-09-30T10:01:00Z'));
    });

    it('catches up at once when its key changes', () => {
        const { result, rerender } = renderHook(({ key }) => useNow(key), {
            initialProps: { key: 'first' },
        });

        vi.setSystemTime(new Date('2026-09-30T10:00:30Z'));
        rerender({ key: 'second' });

        expect(result.current).toBe(Date.parse('2026-09-30T10:00:30Z'));
    });
});
