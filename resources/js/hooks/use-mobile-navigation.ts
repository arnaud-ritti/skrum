import { useCallback } from 'react';

type CleanupFn = () => void;

export function useMobileNavigation(): CleanupFn {
    return useCallback(() => {
        // Remove pointer-events style from body...
        document.body.style.removeProperty('pointer-events');
    }, []);
}
