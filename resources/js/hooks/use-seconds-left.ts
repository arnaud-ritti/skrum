import { useEffect, useState } from 'react';

/**
 * Seconds left of a cooldown the server announced. The server stays the
 * judge: this only spares a request that would send nothing.
 */
export function useSecondsLeft(
    initial: number,
): [number, (seconds: number) => void] {
    const [seconds, setSeconds] = useState(() => Math.max(0, initial));

    useEffect(() => {
        if (seconds <= 0) {
            return;
        }

        const timer = window.setTimeout(
            () => setSeconds((current) => Math.max(0, current - 1)),
            1000,
        );

        return () => window.clearTimeout(timer);
    }, [seconds]);

    return [seconds, (next: number) => setSeconds(Math.max(0, next))];
}
