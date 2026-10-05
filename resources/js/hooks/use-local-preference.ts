import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Map<string, Set<() => void>>();

/** Choices kept for this page only, when the storage refuses them. */
const unsaved = new Map<string, boolean>();

function read(key: string, initial: boolean): boolean {
    const kept = unsaved.get(key);

    if (kept !== undefined) {
        return kept;
    }

    try {
        const stored = window.localStorage.getItem(key);

        return stored === null ? initial : stored === 'true';
    } catch {
        return initial;
    }
}

function subscribe(key: string, listener: () => void): () => void {
    const keyListeners = listeners.get(key) ?? new Set();
    const onStorage = (event: StorageEvent): void => {
        if (event.key === key) {
            listener();
        }
    };

    keyListeners.add(listener);
    listeners.set(key, keyListeners);
    window.addEventListener('storage', onStorage);

    return () => {
        keyListeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
}

/**
 * A yes/no choice kept in this browser. Every component that reads the same
 * key sees a change at once, in this tab and in the others.
 */
export function useLocalPreference(
    key: string,
    initial: boolean,
): [boolean, (value: boolean) => void] {
    const value = useSyncExternalStore(
        useCallback((listener) => subscribe(key, listener), [key]),
        () => read(key, initial),
        () => initial,
    );

    const update = useCallback(
        (next: boolean) => {
            try {
                window.localStorage.setItem(key, String(next));
                unsaved.delete(key);
            } catch {
                unsaved.set(key, next);
            }

            listeners.get(key)?.forEach((listener) => listener());
        },
        [key],
    );

    return [value, update];
}
