import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { canSwitchReadMode, isViewMode, useReadMode } from './use-read-mode';

describe('useReadMode', () => {
    it('opens a board in read mode on a phone', () => {
        const { result } = renderHook(() => useReadMode(true));

        expect(result.current.reading).toBe(true);
    });

    it('opens a board in edit mode above the phone width', () => {
        const { result } = renderHook(() => useReadMode(false));

        expect(result.current.reading).toBe(false);
    });

    it('goes to edit mode and back on a phone', () => {
        const { result } = renderHook(() => useReadMode(true));

        act(() => result.current.setReading(false));

        expect(result.current.reading).toBe(false);

        act(() => result.current.setReading(true));

        expect(result.current.reading).toBe(true);
    });

    it('never reads above the phone width, whatever was chosen on the phone', () => {
        const { result, rerender } = renderHook(
            ({ isPhone }) => useReadMode(isPhone),
            { initialProps: { isPhone: true } },
        );

        rerender({ isPhone: false });

        expect(result.current.reading).toBe(false);

        rerender({ isPhone: true });

        expect(result.current.reading).toBe(true);
    });

    it('keeps a board opened on a wide screen in edit mode when the window narrows', () => {
        const { result, rerender } = renderHook(
            ({ isPhone }) => useReadMode(isPhone),
            { initialProps: { isPhone: false } },
        );

        rerender({ isPhone: true });

        expect(result.current.reading).toBe(false);
    });
});

describe('isViewMode', () => {
    it('is the lock or the read mode', () => {
        expect(isViewMode(false, false)).toBe(false);
        expect(isViewMode(false, true)).toBe(true);
        expect(isViewMode(true, true)).toBe(true);
    });

    it('lets the lock keep the last word over the edit mode', () => {
        expect(isViewMode(true, false)).toBe(true);
    });
});

describe('canSwitchReadMode', () => {
    it('is for a phone viewer who may edit', () => {
        expect(canSwitchReadMode(true, false)).toBe(true);
    });

    it('is not for a viewer the lock keeps from editing', () => {
        expect(canSwitchReadMode(true, true)).toBe(false);
    });

    it('is not for a wider screen', () => {
        expect(canSwitchReadMode(false, false)).toBe(false);
        expect(canSwitchReadMode(false, true)).toBe(false);
    });
});
