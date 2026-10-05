import { useEffect, useState } from 'react';

function offsetOf(serverTime: string): number {
    return new Date(serverTime).getTime() - Date.now();
}

/**
 * The server clock minus this one, taken once for each server time. Kept in
 * state, not in a memo: the React Compiler moves `Date.now()` out of a memo,
 * which made the offset follow the clock and froze every countdown.
 */
export function useServerOffset(serverTime: string): number {
    const [taken, setTaken] = useState(() => ({
        serverTime,
        offset: offsetOf(serverTime),
    }));

    if (taken.serverTime === serverTime) {
        return taken.offset;
    }

    const next = { serverTime, offset: offsetOf(serverTime) };

    setTaken(next);

    return next.offset;
}

export function useCountdown(
    endsAt: string | null,
    offset: number,
): number | null {
    const [now, setNow] = useState(() => Date.now() + offset);

    useEffect(() => {
        if (endsAt === null) {
            return;
        }

        const tick = () => {
            const current = Date.now() + offset;

            setNow(current);

            if (current >= new Date(endsAt).getTime()) {
                window.clearInterval(interval);
            }
        };
        const interval = window.setInterval(tick, 250);

        tick();

        return () => window.clearInterval(interval);
    }, [endsAt, offset]);

    if (endsAt === null) {
        return null;
    }

    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

export function formatSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);

    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/** A running clock, minutes padded: "04:32". */
export function formatClock(seconds: number): string {
    return formatSeconds(seconds).padStart(5, '0');
}
