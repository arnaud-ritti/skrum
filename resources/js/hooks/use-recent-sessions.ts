import { useEffect, useRef, useState } from 'react';
import RecentSessionsController from '@/actions/App/Http/Controllers/RecentSessionsController';
import { retroRequest } from '@/lib/retro/api';

export type RecentSessionKind = 'retro' | 'poker' | 'whiteboard' | 'game';

export type RecentSession = {
    kind: RecentSessionKind;
    id: string;
    title: string;
    team: { id: string; name: string };
    url: string;
    updatedAt: string;
    live: boolean;
};

/** An opening of the palette this long after the last answer asks again. */
export const RecentSessionsFreshMs = 30_000;

/**
 * "Recent sessions" of the palette: read when the palette first opens, not
 * on page load, and again on a later opening once the answer is stale.
 */
export function useRecentSessions(open: boolean): {
    sessions: RecentSession[];
    loading: boolean;
    failed: boolean;
} {
    const [sessions, setSessions] = useState<RecentSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const askedAt = useRef<number | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        if (
            askedAt.current !== null &&
            Date.now() - askedAt.current < RecentSessionsFreshMs
        ) {
            return;
        }

        askedAt.current = Date.now();
        setLoading(true);

        retroRequest<{ sessions: RecentSession[] }>(
            RecentSessionsController.index(),
        )
            .then((response) => {
                setSessions(response.sessions);
                setFailed(false);
                setLoading(false);
            })
            .catch(() => {
                askedAt.current = null;

                setFailed(true);
                setLoading(false);
            });
    }, [open]);

    return { sessions, loading, failed };
}
