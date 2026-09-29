import { useSyncExternalStore } from 'react';

function subscribe(): () => void {
    return () => {};
}

/**
 * False on the server and during hydration, true afterwards, so values that
 * depend on the client clock or locale never cause a hydration mismatch.
 */
export function useIsMounted(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
}
