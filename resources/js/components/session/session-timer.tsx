import type { ReactNode } from 'react';
import { Timer } from '@/components/skrum/timer';
import type { TimerSuggestion } from '@/components/skrum/timer';
import { Badge } from '@/components/ui/badge';
import { useCountdown } from '@/hooks/use-countdown';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import { useTimerAlarm } from './use-timer-alarm';

type SessionTimerProps = {
    endsAt: string | null;
    /** Server clock offset in milliseconds. */
    offset: number;
    /** A retro phase's duration, offered to the facilitator before the list. */
    suggestion?: TimerSuggestion;
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
    /** "lg" on a stage: the topic timer of the discussion. */
    size?: 'md' | 'lg';
    /** A line beside the time: "of 5:00 · this topic". */
    caption?: ReactNode;
    className?: string;
};

export function SessionTimer({
    endsAt,
    offset,
    suggestion,
    totalSeconds,
    onStart,
    onStop,
    onCustom,
    onExtend,
    pausedSeconds = null,
    onPause,
    onResume,
    alarm = true,
    size,
    caption,
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
            suggestion={suggestion}
            onStart={onStart}
            onStop={onStop}
            onCustom={onCustom}
            onAdd={onExtend}
            addSeconds={120}
            size={size}
            caption={caption}
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
