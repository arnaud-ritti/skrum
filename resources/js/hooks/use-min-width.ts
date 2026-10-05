import { useCallback, useSyncExternalStore } from 'react';

/**
 * true when the viewport is at least `width` wide. For a container that
 * mounts one of two controls: a control hidden with CSS would stay in the
 * document under the same name as the one shown. The server and the first
 * paint assume a wide screen.
 */
export function useMinWidth(width: number, unit: 'px' | 'rem' = 'px'): boolean {
    const query = `(min-width: ${width}${unit})`;
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
