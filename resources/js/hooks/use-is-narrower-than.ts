import { useCallback, useSyncExternalStore } from 'react';

/**
 * true when the viewport is narrower than `width`, in rem: the boundary of
 * `useMinWidth` read from its other side, for a screen that mounts a control
 * in one of two places. The server and the first paint assume a wide screen.
 */
export function useIsNarrowerThan(width: number): boolean {
    const query = `not all and (min-width: ${width}rem)`;
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
        () => false,
    );
}
