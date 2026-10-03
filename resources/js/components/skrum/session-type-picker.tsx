import {
    ChartColumn,
    Check,
    CircleCheck,
    Clock,
    Layers,
    Lock,
    PenTool,
    Spade,
    Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type SessionType =
    | 'retro'
    | 'poker'
    | 'whiteboard'
    | 'survey'
    | 'icebreaker';

export type SessionTypeOption = {
    value: SessionType;
    label: string;
    description: string;
    duration: string;
    disabledReason?: string;
};

export type SessionTypePickerProps = {
    value: SessionType;
    onValueChange: (value: SessionType) => void;
    options?: SessionTypeOption[];
    /** `inline`: the one-line tiles of the creation dialog, a scrolling row when narrow. */
    variant?: 'tiles' | 'compact' | 'inline';
    label?: string;
    help?: string;
    as?: 'radiogroup' | 'menu';
    className?: string;
};

const kinds: Record<SessionType, { icon: LucideIcon; tone: string }> = {
    retro: {
        icon: Layers,
        tone: 'border-skrum-col-coral-border bg-skrum-col-coral text-skrum-col-coral-text',
    },
    poker: {
        icon: Spade,
        tone: 'border-skrum-col-moss-border bg-skrum-col-moss text-skrum-col-moss-text',
    },
    whiteboard: {
        icon: PenTool,
        tone: 'border-skrum-col-sky-border bg-skrum-col-sky text-skrum-col-sky-text',
    },
    survey: {
        icon: ChartColumn,
        tone: 'border-skrum-col-iris-border bg-skrum-col-iris text-skrum-col-iris-text',
    },
    icebreaker: {
        icon: Sparkles,
        tone: 'border-skrum-col-sun-border bg-skrum-col-sun text-skrum-col-sun-text',
    },
};

/** The tile colours of a kind: border, background and text tokens. */
export function sessionKindTone(kind: SessionType): string {
    return kinds[kind].tone;
}

export function sessionKindIcon(kind: SessionType): LucideIcon {
    return kinds[kind].icon;
}

export function useDefaultSessionTypeOptions(): SessionTypeOption[] {
    const { t } = useTrans();

    return [
        {
            value: 'retro',
            label: t('Retro'),
            description: t('Look back on the sprint and agree on actions.'),
            duration: t('45–90 min'),
        },
        {
            value: 'poker',
            label: t('Planning poker'),
            description: t('Estimate stories together with cards.'),
            duration: t('30–60 min'),
        },
        {
            value: 'whiteboard',
            label: t('Whiteboard'),
            description: t('Sketch and map ideas on a shared canvas.'),
            duration: t('No time limit'),
        },
        {
            value: 'survey',
            label: t('Poll'),
            description: t('Quick vote or health check'),
            duration: t('5–10 min'),
        },
        {
            value: 'icebreaker',
            label: t('Icebreaker'),
            description: t('Warm up the room before you start.'),
            duration: t('5–15 min'),
        },
    ];
}

function TypeSquare({
    type,
    disabled,
    compact,
}: {
    type: SessionType;
    disabled: boolean;
    compact: boolean;
}) {
    const { icon: Icon, tone } = kinds[type];

    return (
        <span
            aria-hidden
            className={cn(
                'grid shrink-0 place-items-center rounded-md border',
                compact ? 'size-8' : 'size-9',
                tone,
                disabled && 'opacity-50',
            )}
        >
            <Icon className="size-4" />
        </span>
    );
}

function nextEnabledIndex(
    options: SessionTypeOption[],
    from: number,
    step: 1 | -1,
): number {
    for (let offset = 1; offset <= options.length; offset++) {
        const index =
            (from + step * offset + options.length * offset) % options.length;

        if (!options[index].disabledReason) {
            return index;
        }
    }

    return from;
}

export function SessionTypePicker({
    value,
    onValueChange,
    options,
    variant = 'tiles',
    label,
    help,
    as = 'radiogroup',
    className,
}: SessionTypePickerProps) {
    const { t } = useTrans();
    const defaultOptions = useDefaultSessionTypeOptions();
    const items = options ?? defaultOptions;
    const labelId = useId();
    const helpId = useId();
    const reasonIdPrefix = useId();
    const refs = useRef<Record<string, HTMLButtonElement | null>>({});
    const compact = variant === 'compact';
    const inline = variant === 'inline';

    const selectedIndex = items.findIndex(
        (item) => item.value === value && !item.disabledReason,
    );
    const tabbableIndex =
        selectedIndex >= 0 ? selectedIndex : nextEnabledIndex(items, -1, 1);

    const moveSelection = (
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ) => {
        const step =
            event.key === 'ArrowRight' || event.key === 'ArrowDown'
                ? 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                  ? -1
                  : null;

        if (step === null) {
            return;
        }

        event.preventDefault();

        const target = items[nextEnabledIndex(items, index, step)];

        onValueChange(target.value);
        refs.current[target.value]?.focus();
    };

    const heading: ReactNode = label ? (
        <p id={labelId} className="text-sm font-semibold">
            {label}
        </p>
    ) : null;

    const helpText: ReactNode = help ? (
        <p id={helpId} className="text-xs text-muted-foreground">
            {help}
        </p>
    ) : null;

    if (as === 'menu') {
        return (
            <DropdownMenuRadioGroup
                value={value}
                onValueChange={(next) => onValueChange(next as SessionType)}
                className={className}
            >
                {items.map((item) => {
                    const disabled = Boolean(item.disabledReason);

                    return (
                        <DropdownMenuRadioItem
                            key={item.value}
                            value={item.value}
                            disabled={disabled}
                            data-type={item.value}
                            className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-2 py-1.5"
                        >
                            <TypeSquare
                                type={item.value}
                                disabled={disabled}
                                compact
                            />
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-title">
                                    {item.label}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {item.disabledReason ?? item.description}
                                </span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                {disabled ? (
                                    <Lock aria-hidden className="size-3.5" />
                                ) : (
                                    item.duration
                                )}
                            </span>
                        </DropdownMenuRadioItem>
                    );
                })}
            </DropdownMenuRadioGroup>
        );
    }

    return (
        <div
            className={cn(
                'flex flex-col gap-2',
                inline && '@container/types min-w-0',
                className,
            )}
        >
            {heading}
            <div
                role="radiogroup"
                aria-labelledby={label ? labelId : undefined}
                aria-label={label ? undefined : t('Session type')}
                aria-describedby={help ? helpId : undefined}
                data-variant={variant}
                className={cn(
                    compact && 'flex flex-col gap-1',
                    inline &&
                        '-m-1 flex gap-2 overflow-x-auto p-1 @2xl/types:grid @2xl/types:auto-cols-fr @2xl/types:grid-flow-col',
                    !compact &&
                        !inline &&
                        'grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(40)),1fr))] gap-2',
                )}
            >
                {items.map((item, index) => {
                    const disabled = Boolean(item.disabledReason);
                    const checked = item.value === value && !disabled;
                    const reasonId = `${reasonIdPrefix}-${item.value}`;

                    return (
                        <button
                            key={item.value}
                            ref={(node) => {
                                refs.current[item.value] = node;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            aria-disabled={disabled || undefined}
                            aria-describedby={disabled ? reasonId : undefined}
                            tabIndex={index === tabbableIndex ? 0 : -1}
                            data-type={item.value}
                            data-state={checked ? 'checked' : 'unchecked'}
                            data-disabled={disabled ? '' : undefined}
                            onClick={() => {
                                if (!disabled) {
                                    onValueChange(item.value);
                                }
                            }}
                            onKeyDown={(event) => moveSelection(event, index)}
                            className={cn(
                                'relative border border-input bg-card text-left transition-colors duration-140 outline-none hover:border-primary/35 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:cursor-not-allowed aria-disabled:border-dashed aria-disabled:bg-muted aria-disabled:hover:border-input aria-disabled:hover:bg-muted data-[state=checked]:border-primary data-[state=checked]:bg-skrum-primary-soft data-[state=checked]:ring-1 data-[state=checked]:ring-primary data-[state=checked]:ring-inset',
                                compact &&
                                    'grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5',
                                inline &&
                                    'flex max-w-64 min-w-44 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 @2xl/types:max-w-none @2xl/types:min-w-0',
                                !compact &&
                                    !inline &&
                                    'flex flex-col items-start gap-1 rounded-lg p-3',
                            )}
                        >
                            <TypeSquare
                                type={item.value}
                                disabled={disabled}
                                compact={compact}
                            />
                            {compact || inline ? (
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-title">
                                        {item.label}
                                    </span>
                                    <span
                                        id={disabled ? reasonId : undefined}
                                        className={cn(
                                            'block truncate text-xs',
                                            disabled
                                                ? 'text-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {item.disabledReason ??
                                            item.description}
                                    </span>
                                </span>
                            ) : (
                                <>
                                    <span className="block w-full truncate text-sm font-title">
                                        {item.label}
                                    </span>
                                    <span className="line-clamp-2 text-xs text-muted-foreground">
                                        {item.description}
                                    </span>
                                    {disabled ? (
                                        <span
                                            id={reasonId}
                                            className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-foreground"
                                        >
                                            {item.disabledReason}
                                        </span>
                                    ) : (
                                        <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                            <Clock
                                                aria-hidden
                                                className="size-3.5"
                                            />
                                            {item.duration}
                                        </span>
                                    )}
                                </>
                            )}
                            {compact ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                    {disabled ? (
                                        <Lock
                                            aria-hidden
                                            className="size-3.5"
                                        />
                                    ) : (
                                        <>
                                            {item.duration}
                                            {checked ? (
                                                <Check
                                                    aria-hidden
                                                    className="size-4 text-primary"
                                                />
                                            ) : null}
                                        </>
                                    )}
                                </span>
                            ) : null}
                            {inline && disabled ? (
                                <Lock
                                    aria-hidden
                                    className="ml-auto size-3.5 shrink-0 text-muted-foreground"
                                />
                            ) : null}
                            {!compact && !inline && checked ? (
                                <CircleCheck
                                    aria-hidden
                                    className="absolute top-3 right-3 size-4 text-primary"
                                />
                            ) : null}
                            {!compact && !inline && disabled ? (
                                <Lock
                                    aria-hidden
                                    className="absolute top-3 right-3 size-4 text-muted-foreground"
                                />
                            ) : null}
                        </button>
                    );
                })}
            </div>
            {helpText}
        </div>
    );
}
