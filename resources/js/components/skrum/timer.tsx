import {
    AlarmClock,
    Pause,
    Play,
    SlidersHorizontal,
    Square,
    Timer as TimerIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
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
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import { cn } from '@/lib/utils';

export const TimerPresetMinutes = [1, 3, 5, 10];

export type TimerPreset = {
    seconds: number;
    /** Defaults to the duration, in minutes or in seconds. */
    label?: string;
};

export const DefaultTimerPresets: TimerPreset[] = TimerPresetMinutes.map(
    (minutes) => ({ seconds: minutes * 60 }),
);

export type TimerProps = {
    remainingSeconds: number | null;
    totalSeconds?: number;
    paused?: boolean;
    size?: 'md' | 'lg';
    lowThresholdSeconds?: number;
    onStart?: (seconds: number) => void;
    /** Durations of the menu; 1, 3, 5 and 10 minutes by default. */
    presets?: TimerPreset[];
    /** Adds a "Custom…" entry; the container opens its own dialog. */
    onCustom?: () => void;
    onStop?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onAdd?: (seconds: number) => void;
    /** Seconds added by the "+" control and the + key; one minute by default. A multiple of 60: the label counts minutes. */
    addSeconds?: number;
    onDone?: () => void;
    /** A line beside the time, before the controls: "of 5:00 · this topic". */
    caption?: ReactNode;
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
    presets = DefaultTimerPresets,
    onCustom,
    onStop,
    onPause,
    onResume,
    onAdd,
    addSeconds = 60,
    onDone,
    caption,
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
    const hasMenu =
        onStart !== undefined || onStop !== undefined || onCustom !== undefined;
    const hasStartEntries =
        (onStart !== undefined && presets.length > 0) || onCustom !== undefined;

    function presetLabel(preset: TimerPreset): string {
        if (preset.label !== undefined) {
            return preset.label;
        }

        return preset.seconds % 60 === 0
            ? t(':count min', { count: preset.seconds / 60 })
            : t(':count s', { count: preset.seconds });
    }
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

        // T and + are the only keys of the timer: both are single keys.
        if (!singleKeyShortcutsEnabled()) {
            return;
        }

        if ((event.key === 't' || event.key === 'T') && hasTimer) {
            if (toggle) {
                event.preventDefault();
                toggle();
            }

            return;
        }

        if (event.key === '+' && onAdd && hasTimer) {
            event.preventDefault();
            onAdd(addSeconds);
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

    // One button for pause and resume: it stays mounted, so focus (and the T
    // key, which needs focus inside the timer) survives every change of state.
    const hasToggle = onPause !== undefined || onResume !== undefined;
    const toggle = isDone ? undefined : paused ? onResume : onPause;
    const StateIcon = isDone ? AlarmClock : paused ? Pause : null;
    const iconSize = isBig ? 'size-6' : 'size-4';
    const fraction =
        totalSeconds !== undefined && totalSeconds > 0 && hasTimer
            ? remainingSeconds / totalSeconds
            : null;

    return (
        <div
            data-slot="timer"
            data-size={size}
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
            {hasTimer && caption !== undefined && (
                <span
                    data-slot="timer-caption"
                    className="text-xs whitespace-nowrap text-muted-foreground"
                >
                    {caption}
                </span>
            )}
            <span
                data-slot="timer-announcement"
                role="status"
                aria-live="assertive"
                className="sr-only"
            >
                {announcement}
            </span>
            {hasTimer && hasToggle && (
                <Button
                    type="button"
                    variant="outline"
                    size={isBig ? 'icon' : 'icon-sm'}
                    data-slot="timer-toggle"
                    aria-label={paused ? t('Resume timer') : t('Pause timer')}
                    aria-disabled={toggle === undefined || undefined}
                    aria-keyshortcuts="T"
                    className={cn(
                        toggle === undefined && 'cursor-not-allowed opacity-50',
                    )}
                    onClick={() => toggle?.()}
                >
                    {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
                </Button>
            )}
            {hasTimer && onAdd && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAdd(addSeconds)}
                >
                    <span className="truncate">
                        {t('+:count min', { count: addSeconds / 60 })}
                    </span>
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
                    <DropdownMenuContent align="end" size="wide">
                        {onStart &&
                            presets.map((preset) => (
                                <DropdownMenuItem
                                    key={preset.seconds}
                                    onSelect={() => onStart(preset.seconds)}
                                    className="whitespace-nowrap"
                                >
                                    {presetLabel(preset)}
                                </DropdownMenuItem>
                            ))}
                        {onCustom && (
                            <DropdownMenuItem onSelect={onCustom}>
                                <SlidersHorizontal aria-hidden />
                                <span className="truncate">{t('Custom…')}</span>
                            </DropdownMenuItem>
                        )}
                        {hasStartEntries && onStop && <DropdownMenuSeparator />}
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
