import { useIsMounted } from '@/hooks/use-is-mounted';

/** Host of the instance, empty until the page runs in a browser. */
export function useInstanceHost(): string {
    return useIsMounted() ? window.location.host : '';
}
