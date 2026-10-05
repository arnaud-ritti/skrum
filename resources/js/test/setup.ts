import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {} } }),
    };
});

if (typeof window.matchMedia === 'undefined') {
    window.matchMedia = (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    };
}

function memoryStorage(): Storage {
    const entries = new Map<string, string>();

    return {
        get length() {
            return entries.size;
        },
        clear: () => entries.clear(),
        getItem: (key) => entries.get(key) ?? null,
        key: (index) => [...entries.keys()][index] ?? null,
        removeItem: (key) => void entries.delete(key),
        setItem: (key, value) => void entries.set(key, String(value)),
    };
}

function hasStorage(name: 'localStorage' | 'sessionStorage'): boolean {
    try {
        return typeof globalThis[name]?.getItem === 'function';
    } catch {
        return false;
    }
}

/**
 * Node 24 defines its own `localStorage`, which is undefined without
 * `--localstorage-file` and hides the one of jsdom in some workers of a full
 * run: a file that reads the storage then failed one run in three.
 */
for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (!hasStorage(name)) {
        Object.defineProperty(globalThis, name, {
            configurable: true,
            value: memoryStorage(),
        });
    }
}

afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, 'clipboard');
});
