import { Timer } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { formatSeconds, useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

function beep() {
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

type Props = { endsAt: string | null; offset: number };

export function TimerDisplay({ endsAt, offset }: Props) {
    const { t } = useTrans();
    const remaining = useCountdown(endsAt, offset);
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

    if (remaining === null) {
        return null;
    }

    return (
        <span
            role="timer"
            className={cn(
                'flex items-center gap-1 font-mono text-sm',
                remaining === 0 && 'text-destructive',
            )}
        >
            <Timer className="size-4" aria-hidden="true" />
            {remaining === 0 ? t("Time's up!") : formatSeconds(remaining)}
        </span>
    );
}
