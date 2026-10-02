import { useCallback, useSyncExternalStore } from 'react';

/**
 * true when the viewport is at least `pixels` wide. For a container that
 * mounts one of two controls: a control hidden with CSS would stay in the
 * document under the same name as the one shown.
 */
export function useMinWidth(pixels: number): boolean {
    const query = `(min-width: ${pixels}px)`;
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
