import {
    AlarmClock,
    Pause,
    Play,
    Plus,
    Square,
    Timer as TimerIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatSeconds } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export const TimerPresetMinutes = [1, 3, 5, 10];

export type TimerProps = {
    remainingSeconds: number | null;
    totalSeconds?: number;
    paused?: boolean;
    size?: 'md' | 'lg';
    lowThresholdSeconds?: number;
    onStart?: (seconds: number) => void;
    onStop?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onAdd?: (seconds: number) => void;
    onDone?: () => void;
    className?: string;
};

function TimerRing({ fraction, big }: { fraction: number; big: boolean }) {
    const radius = 9;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(Math.max(fraction, 0), 1);

    return (
        <svg
            data-slot="timer-ring"
            viewBox="0 0 24 24"
            aria-hidden
            className={cn('shrink-0 -rotate-90', big ? 'size-7' : 'size-5')}
        >
            <circle
                cx="12"
                cy="12"
                r={radius}
                fill="none"
                strokeWidth="3"
                className="stroke-current opacity-20"
            />
            <circle
                cx="12"
                cy="12"
                r={radius}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - clamped)}
                className="stroke-current"
            />
        </svg>
    );
}

export function Timer({
    remainingSeconds,
    totalSeconds,
    paused = false,
    size = 'md',
    lowThresholdSeconds = 60,
    onStart,
    onStop,
    onPause,
    onResume,
    onAdd,
    onDone,
    className,
}: TimerProps) {
    const { t } = useTrans();
    const [announcement, setAnnouncement] = useState('');
    const previous = useRef<number | null>(null);
    const onDoneRef = useRef(onDone);
    const isBig = size === 'lg';
    const hasTimer = remainingSeconds !== null;
    const isDone = remainingSeconds === 0 && !paused;
    const isLow =
        hasTimer &&
        !isDone &&
        !paused &&
        remainingSeconds < lowThresholdSeconds;
    const hasMenu = onStart !== undefined || onStop !== undefined;
    const hasControls =
        hasMenu ||
        onPause !== undefined ||
        onResume !== undefined ||
        onAdd !== undefined;

    useEffect(() => {
        onDoneRef.current = onDone;
    });

    useEffect(() => {
        const before = previous.current;
        previous.current = remainingSeconds;

        if (remainingSeconds === null || before === null || paused) {
            return;
        }

        if (remainingSeconds === 0 && before > 0) {
            setAnnouncement(t("Time's up!"));
            onDoneRef.current?.();

            return;
        }

        if (before > 10 && remainingSeconds <= 10 && remainingSeconds > 0) {
            setAnnouncement(t('10 seconds left'));

            return;
        }

        if (before > 60 && remainingSeconds <= 60 && remainingSeconds > 10) {
            setAnnouncement(t('1 minute left'));
        }
    }, [remainingSeconds, paused, t]);

    function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        const target = event.target as HTMLElement;

        if (target.closest('input, textarea, [contenteditable="true"]')) {
            return;
        }

        if ((event.key === 't' || event.key === 'T') && hasTimer) {
            const toggle = paused ? onResume : onPause;

            if (toggle) {
                event.preventDefault();
                toggle();
            }

            return;
        }

        if (event.key === '+' && onAdd && hasTimer) {
            event.preventDefault();
            onAdd(60);
        }
    }

    function accessibleLabel(seconds: number): string {
        if (seconds === 0) {
            return t("Time's up!");
        }

        const minutes = Math.ceil(seconds / 60);
        const base =
            seconds < 60
                ? t('Less than a minute left')
                : t(':count minutes left', { count: minutes });

        return paused ? t('Paused, :time', { time: base }) : base;
    }

    if (!hasTimer && !hasControls) {
        return null;
    }

    const StateIcon = isDone ? AlarmClock : paused ? Pause : null;
    const iconSize = isBig ? 'size-6' : 'size-4';
    const fraction =
        totalSeconds !== undefined && totalSeconds > 0 && hasTimer
            ? remainingSeconds / totalSeconds
            : null;

    return (
        <div
            data-slot="timer"
            onKeyDown={hasControls ? handleKeyDown : undefined}
            className={cn(
                'inline-flex max-w-full items-center gap-2',
                className,
            )}
        >
            {hasTimer && (
                <div
                    data-slot="timer-pill"
                    data-state={
                        isDone
                            ? 'done'
                            : paused
                              ? 'paused'
                              : isLow
                                ? 'low'
                                : 'normal'
                    }
                    role="timer"
                    aria-label={accessibleLabel(remainingSeconds)}
                    className={cn(
                        'inline-flex shrink-0 items-center gap-2 rounded-md font-mono text-stat font-semibold tabular-nums',
                        isBig ? 'px-4 py-2' : 'px-3 py-1',
                        isDone &&
                            'animate-nudge bg-destructive text-destructive-foreground motion-reduce:animate-none',
                        isLow &&
                            'bg-skrum-warning text-skrum-warning-foreground',
                        paused && !isDone && 'bg-muted text-muted-foreground',
                        !isDone &&
                            !isLow &&
                            !paused &&
                            'bg-muted text-foreground',
                    )}
                >
                    {StateIcon ? (
                        <StateIcon className={iconSize} aria-hidden />
                    ) : fraction !== null ? (
                        <TimerRing fraction={fraction} big={isBig} />
                    ) : (
                        <TimerIcon className={iconSize} aria-hidden />
                    )}
                    <span aria-hidden className={cn(!isBig && 'text-base')}>
                        {formatSeconds(remainingSeconds)}
                    </span>
                </div>
            )}
            <span
                data-slot="timer-announcement"
                role="status"
                aria-live="assertive"
                className="sr-only"
            >
                {announcement}
            </span>
            {hasTimer && !isDone && paused && onResume && (
                <Button
                    type="button"
                    variant="outline"
                    size={isBig ? 'icon' : 'icon-sm'}
                    aria-label={t('Resume timer')}
                    onClick={onResume}
                >
                    <Play aria-hidden />
                </Button>
            )}
            {hasTimer && !isDone && !paused && onPause && (
                <Button
                    type="button"
                    variant="outline"
                    size={isBig ? 'icon' : 'icon-sm'}
                    aria-label={t('Pause timer')}
                    onClick={onPause}
                >
                    <Pause aria-hidden />
                </Button>
            )}
            {hasTimer && onAdd && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAdd(60)}
                >
                    <Plus aria-hidden />
                    <span className="truncate">{t('1 min')}</span>
                </Button>
            )}
            {hasMenu && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size={isBig ? 'icon' : 'icon-sm'}
                            aria-label={t('Timer')}
                        >
                            <AlarmClock aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {onStart &&
                            TimerPresetMinutes.map((minutes) => (
                                <DropdownMenuItem
                                    key={minutes}
                                    onSelect={() => onStart(minutes * 60)}
                                >
                                    <span className="truncate">
                                        {t(':count min', { count: minutes })}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        {onStart && onStop && <DropdownMenuSeparator />}
                        {onStop && (
                            <DropdownMenuItem
                                disabled={!hasTimer}
                                onSelect={onStop}
                            >
                                <Square aria-hidden />
                                <span className="truncate">
                                    {t('Stop timer')}
                                </span>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
