import { useCallback, useSyncExternalStore } from 'react';

/**
 * Width of the window, in rem, from which a session's header holds its
 * secondary controls as buttons (a retro's pointer mode, settings and health
 * check, a whiteboard's Export, the keyboard shortcuts); below it they are
 * entries of its menu. The header spans the window, and a menu is drawn
 * outside it: the window is read, not the header's container.
 */
export const SecondaryControlsFrom = 96;

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
