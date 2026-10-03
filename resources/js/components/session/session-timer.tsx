import { Timer } from '@/components/skrum/timer';
import type { TimerPreset } from '@/components/skrum/timer';
import { Badge } from '@/components/ui/badge';
import { useCountdown } from '@/hooks/use-countdown';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import { useTimerAlarm } from './use-timer-alarm';

type SessionTimerProps = {
    endsAt: string | null;
    /** Server clock offset in milliseconds. */
    offset: number;
    /** Never passed by a page: every screen has the Timer's own list, 1, 3, 5, 10 minutes. */
    presets?: TimerPreset[];
    /** Seconds chosen at start, for the ring; absent for a late joiner. */
    totalSeconds?: number;
    /** Given only to who may start and stop (the facilitator, the host). */
    onStart?: (seconds: number) => void;
    onStop?: () => void;
    /** Poker only: opens its custom-duration dialog. */
    onCustom?: () => void;
    /** Adds two minutes to the timer. Shown as "+2 min" while a timer runs or is paused. */
    onExtend?: () => void;
    /** The seconds left of a paused timer; null or absent unless paused. */
    pausedSeconds?: number | null;
    /** Given only to who may pause and resume (the facilitator of a retro). */
    onPause?: () => void;
    onResume?: () => void;
    /** false in a game room: it shows <TimeUpBadge> instead of a toast. */
    alarm?: boolean;
    className?: string;
};

export function SessionTimer({
    endsAt,
    offset,
    presets,
    totalSeconds,
    onStart,
    onStop,
    onCustom,
    onExtend,
    pausedSeconds = null,
    onPause,
    onResume,
    alarm = true,
    className,
}: SessionTimerProps) {
    const isPaused = pausedSeconds !== null;
    const remaining = useCountdown(isPaused ? null : endsAt, offset);
    const isMounted = useIsMounted();

    useTimerAlarm(alarm && !isPaused ? endsAt : null, remaining, offset);

    // A paused timer does not move: its seconds are the same on the server
    // and in every browser, so they show from the first render.
    const remainingSeconds = isPaused
        ? pausedSeconds
        : isMounted
          ? remaining
          : null;

    return (
        <Timer
            remainingSeconds={remainingSeconds}
            paused={isPaused}
            onPause={onPause}
            onResume={isPaused ? onResume : undefined}
            totalSeconds={totalSeconds}
            presets={presets}
            onStart={onStart}
            onStop={onStop}
            onCustom={onCustom}
            onAdd={onExtend ? () => onExtend() : undefined}
            addSeconds={120}
            className={className}
        />
    );
}

/** Destructive badge "Time's up", rendered by a game inside <main>, next to the stage title. */
export function TimeUpBadge({
    endsAt,
    offset,
}: {
    endsAt: string | null;
    offset: number;
}) {
    const { t } = useTrans();
    const remaining = useCountdown(endsAt, offset);

    if (remaining !== 0) {
        return null;
    }

    return <Badge variant="destructive">{t("Time's up")}</Badge>;
}
