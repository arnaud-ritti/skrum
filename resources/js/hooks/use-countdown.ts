import { useEffect, useMemo, useState } from 'react';

export function useServerOffset(serverTime: string): number {
    return useMemo(
        () => new Date(serverTime).getTime() - Date.now(),
        [serverTime],
    );
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

        const interval = window.setInterval(
            () => setNow(Date.now() + offset),
            250,
        );

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
