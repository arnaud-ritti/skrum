import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeTheme, useAppearance } from '@/hooks/use-appearance';

function systemScheme(dark: boolean) {
    const listeners = new Set<() => void>();
    const query = {
        matches: dark,
        media: '(prefers-color-scheme: dark)',
        addEventListener: (_: string, listener: () => void) =>
            listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) =>
            listeners.delete(listener),
    };

    vi.spyOn(window, 'matchMedia').mockReturnValue(
        query as unknown as MediaQueryList,
    );

    return {
        change: (next: boolean) => {
            query.matches = next;
            listeners.forEach((listener) => listener());
        },
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useAppearance', () => {
    it('follows a change of the system theme in system mode', () => {
        const scheme = systemScheme(false);

        localStorage.setItem('appearance', 'system');
        initializeTheme();

        const { result } = renderHook(() => useAppearance());

        expect(result.current.resolvedAppearance).toBe('light');

        act(() => scheme.change(true));

        expect(result.current.resolvedAppearance).toBe('dark');
    });

    it('starts on the system theme when the storage is blocked', () => {
        systemScheme(false);
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => initializeTheme()).not.toThrow();

        const { result } = renderHook(() => useAppearance());

        expect(result.current.appearance).toBe('system');
        expect(() =>
            act(() => result.current.updateAppearance('dark')),
        ).not.toThrow();
    });

    it('starts on the system theme when the storage holds something else', () => {
        systemScheme(false);
        localStorage.setItem('appearance', 'purple');

        initializeTheme();

        const { result } = renderHook(() => useAppearance());

        expect(result.current.appearance).toBe('system');
    });
});
