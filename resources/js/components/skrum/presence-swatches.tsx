import { Check, User } from 'lucide-react';
import { useRef } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import type { AvatarPresence } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type PresenceSwatchesProps = {
    value: number | null;
    onChange: (presence: AvatarPresence) => void;
    /** Disabled and marked with a person icon. */
    taken?: number[];
    /** A hidden input carrying the value, for a surrounding form. */
    name?: string;
    /** The radio group's accessible name. */
    label: string;
    /** `md`: 26 px swatches (44 px targets on a narrow card); `lg`: 48 px targets in a 6 × 2 grid. */
    size?: 'md' | 'lg';
    className?: string;
};

export const PresenceNumbers: AvatarPresence[] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

const swatchClasses: Record<AvatarPresence, string> = {
    1: 'bg-skrum-presence-1 text-skrum-presence-1-foreground',
    2: 'bg-skrum-presence-2 text-skrum-presence-2-foreground',
    3: 'bg-skrum-presence-3 text-skrum-presence-3-foreground',
    4: 'bg-skrum-presence-4 text-skrum-presence-4-foreground',
    5: 'bg-skrum-presence-5 text-skrum-presence-5-foreground',
    6: 'bg-skrum-presence-6 text-skrum-presence-6-foreground',
    7: 'bg-skrum-presence-7 text-skrum-presence-7-foreground',
    8: 'bg-skrum-presence-8 text-skrum-presence-8-foreground',
    9: 'bg-skrum-presence-9 text-skrum-presence-9-foreground',
    10: 'bg-skrum-presence-10 text-skrum-presence-10-foreground',
    11: 'bg-skrum-presence-11 text-skrum-presence-11-foreground',
    12: 'bg-skrum-presence-12 text-skrum-presence-12-foreground',
};

const sizes = {
    md: {
        group: 'grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] justify-items-center @sm:grid-cols-[repeat(auto-fill,minmax(2rem,1fr))]',
        target: 'size-11 @sm:size-8',
        swatch: 'size-6.5',
        icon: 'size-3.5',
    },
    lg: {
        group: 'grid grid-cols-6 justify-items-center gap-y-1',
        target: 'size-12',
        swatch: 'size-9',
        icon: 'size-4',
    },
} as const;

/** The first colour after `from`, going `step`, that is not taken. */
export function nextFreePresence(
    from: number,
    step: 1 | -1,
    taken: number[],
): AvatarPresence | null {
    for (let offset = 1; offset <= PresenceNumbers.length; offset++) {
        const index =
            (from - 1 + step * offset + PresenceNumbers.length * 2) %
            PresenceNumbers.length;
        const candidate = PresenceNumbers[index];

        if (!taken.includes(candidate)) {
            return candidate;
        }
    }

    return null;
}

const keySteps: Record<string, 1 | -1> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
};

/** The twelve presence colours as a radio group. */
export function PresenceSwatches({
    value,
    onChange,
    taken = [],
    name,
    label,
    size = 'md',
    className,
}: PresenceSwatchesProps): ReactElement {
    const { t } = useTrans();
    const swatchRefs = useRef<Partial<Record<number, HTMLButtonElement>>>({});
    const selected = PresenceNumbers.find((number) => number === value) ?? null;
    const focusable = selected ?? nextFreePresence(12, 1, taken);
    const classes = sizes[size];

    const choose = (presence: AvatarPresence) => {
        onChange(presence);
        swatchRefs.current[presence]?.focus();
    };

    const onKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        from: AvatarPresence,
    ) => {
        const step = keySteps[event.key];

        if (step === undefined) {
            return;
        }

        event.preventDefault();

        const target = nextFreePresence(from, step, taken);

        if (target !== null) {
            choose(target);
        }
    };

    return (
        <div
            role="radiogroup"
            aria-label={label}
            data-slot="presence-swatches"
            className={cn(classes.group, className)}
        >
            {name !== undefined && (
                <input type="hidden" name={name} value={selected ?? ''} />
            )}
            {PresenceNumbers.map((number) => {
                const isTaken = taken.includes(number);
                const isSelected = selected === number;

                return (
                    <button
                        key={number}
                        ref={(element) => {
                            if (element) {
                                swatchRefs.current[number] = element;
                            }
                        }}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-disabled={isTaken || undefined}
                        aria-label={
                            isTaken
                                ? t('Colour :number (taken)', { number })
                                : t('Colour :number', { number })
                        }
                        disabled={isTaken}
                        tabIndex={focusable === number ? 0 : -1}
                        onClick={() => choose(number)}
                        onKeyDown={(event) => onKeyDown(event, number)}
                        className={cn(
                            'group flex items-center justify-center rounded-full outline-none',
                            classes.target,
                        )}
                    >
                        <span
                            className={cn(
                                'flex items-center justify-center rounded-full transition-shadow duration-140 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-card group-disabled:opacity-35 motion-reduce:transition-none',
                                classes.swatch,
                                swatchClasses[number],
                                isSelected &&
                                    'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                            )}
                        >
                            {isSelected && (
                                <Check className={classes.icon} aria-hidden />
                            )}
                            {isTaken && (
                                <User
                                    data-slot="presence-swatch-taken"
                                    className={classes.icon}
                                    aria-hidden
                                />
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
