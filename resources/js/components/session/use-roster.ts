import { useEffect, useRef } from 'react';
import type { PresenceMember } from '@/lib/retro/types';

/** The ids online, in a ref a transport filter reads; `rosterKey` changes with them. */
export function useRoster(online: PresenceMember[]) {
    const rosterKey = online.map((member) => member.id).join(',');
    const roster = useRef(new Set<string>());

    useEffect(() => {
        roster.current = new Set(rosterKey === '' ? [] : rosterKey.split(','));
    }, [rosterKey]);

    return { roster, rosterKey };
}
