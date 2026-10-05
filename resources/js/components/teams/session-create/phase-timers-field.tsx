import { Minus, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { MaxPhaseMinutes, TimedPhases } from '@/lib/retro/phase-durations';
import type { PhaseDurations } from '@/lib/retro/phase-durations';
import { PhaseLabels } from '@/lib/retro/phases';

type Props = {
    /** Minutes per timed phase; 0 is "Off". */
    value: Required<PhaseDurations>;
    onChange: (value: Required<PhaseDurations>) => void;
};

const stepButtonClasses =
    'grid h-full w-7 place-items-center text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent';

/**
 * "Custom (5 phases)" of the "Timer per phase" row: one minute stepper per
 * timed phase, 0 to 60, where 0 is "Off". A bound only sets `aria-disabled`:
 * a native `disabled` would drop the keyboard focus on the button pressed.
 */
export function PhaseTimersField({ value, onChange }: Props): ReactElement {
    const { t } = useTrans();

    return (
        <div
            data-slot="phase-timers-field"
            className="flex flex-col border-b pb-2 pl-7"
        >
            {TimedPhases.map((phase) => {
                const label = t(PhaseLabels[phase]);
                const minutes = value[phase];
                const atMin = minutes <= 0;
                const atMax = minutes >= MaxPhaseMinutes;
                const set = (next: number) =>
                    onChange({ ...value, [phase]: next });

                return (
                    <div
                        key={phase}
                        className="flex min-h-9 min-w-0 items-center justify-between gap-3"
                    >
                        <span
                            aria-hidden
                            className="truncate text-body-sm text-muted-foreground"
                        >
                            {label}
                        </span>
                        <div
                            id={`new-retro-phase-${phase}`}
                            role="group"
                            aria-label={label}
                            data-slot="stepper"
                            className="inline-flex h-8 shrink-0 items-center rounded-md border border-input bg-card"
                        >
                            <button
                                type="button"
                                aria-label={t('Decrease :label', { label })}
                                aria-disabled={atMin || undefined}
                                onClick={() => !atMin && set(minutes - 1)}
                                className={`${stepButtonClasses} rounded-l-md`}
                            >
                                <Minus aria-hidden className="size-3.5" />
                            </button>
                            <output className="min-w-12 border-x px-1 text-center text-body-sm leading-8 font-semibold tabular-nums">
                                {minutes === 0 ? t('Off') : minutes}
                            </output>
                            <button
                                type="button"
                                aria-label={t('Increase :label', { label })}
                                aria-disabled={atMax || undefined}
                                onClick={() => !atMax && set(minutes + 1)}
                                className={`${stepButtonClasses} rounded-r-md`}
                            >
                                <Plus aria-hidden className="size-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
