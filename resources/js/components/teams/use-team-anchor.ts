import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { NavKey } from '@/components/skrum/app-sidebar';

const Anchors: Record<string, NavKey> = {
    '#sessions': 'sessions',
    '#mood': 'mood',
    '#members': 'members',
};

export function teamAnchor(hash: string): NavKey {
    return Anchors[hash] ?? 'dashboard';
}

/**
 * The team page is four sidebar entries: the page itself and three of its
 * sections. The entry in use is read from the URL hash, after mount (the
 * server does not see a hash) and on every change of it.
 */
export function useTeamAnchor(): NavKey {
    const [anchor, setAnchor] = useState<NavKey>('dashboard');

    useEffect(() => {
        const read = (): void => setAnchor(teamAnchor(window.location.hash));

        read();
        window.addEventListener('hashchange', read);
        const off = router.on('navigate', read);

        return () => {
            window.removeEventListener('hashchange', read);
            off();
        };
    }, []);

    return anchor;
}
