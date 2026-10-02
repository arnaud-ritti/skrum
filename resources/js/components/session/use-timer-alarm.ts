import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTrans } from '@/hooks/use-trans';

function beep(): void {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.onended = () => void context.close();
    oscillator.stop(context.currentTime + 0.6);
}

/** Toast "Time's up!" and a beep, once per end time, only if this client saw the timer running. */
export function useTimerAlarm(
    endsAt: string | null,
    remaining: number | null,
): void {
    const { t } = useTrans();
    const announced = useRef<string | null>(null);
    const sawRunning = useRef<string | null>(null);

    useEffect(() => {
        if (endsAt === null) {
            return;
        }

        if (remaining !== null && remaining > 0) {
            sawRunning.current = endsAt;

            return;
        }

        if (
            remaining !== 0 ||
            sawRunning.current !== endsAt ||
            announced.current === endsAt
        ) {
            return;
        }

        announced.current = endsAt;
        toast(t("Time's up!"));

        try {
            beep();
        } catch {
            // Audio can be unavailable or blocked until the user interacts.
        }
    }, [remaining, endsAt, t]);
}
