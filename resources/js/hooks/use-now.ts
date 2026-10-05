import { useEffect, useState } from 'react';

const MinuteMs = 60_000;

/**
 * The current time for relative labels ("5 minutes ago"): refreshed every
 * minute, and again whenever `refreshKey` changes (new rows from a reload).
 */
export function useNow(refreshKey?: unknown): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        setNow(Date.now());

        const tick = window.setInterval(() => setNow(Date.now()), MinuteMs);

        return () => window.clearInterval(tick);
    }, [refreshKey]);

    return now;
}
