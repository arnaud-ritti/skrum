import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSecondsLeft } from '@/hooks/use-seconds-left';

describe('useSecondsLeft', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('counts down to zero and stops', () => {
        const { result } = renderHook(() => useSecondsLeft(2));

        expect(result.current[0]).toBe(2);
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current[0]).toBe(1);
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(result.current[0]).toBe(0);
    });

    it('restarts when told', () => {
        const { result } = renderHook(() => useSecondsLeft(0));

        act(() => {
            result.current[1](60);
        });
        expect(result.current[0]).toBe(60);
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current[0]).toBe(59);
    });

    it('never goes below zero for a negative start', () => {
        const { result } = renderHook(() => useSecondsLeft(-5));

        expect(result.current[0]).toBe(0);
    });
});
