import { useCallback, useSyncExternalStore } from 'react';

/** True from `rem` wide on; the server and the first paint assume a wide screen. */
export function useMinWidth(rem: number): boolean {
    const query = `(min-width: ${rem}rem)`;

    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = window.matchMedia(query);

            list.addEventListener('change', onChange);

            return () => list.removeEventListener('change', onChange);
        },
        [query],
    );

    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => true,
    );
}
