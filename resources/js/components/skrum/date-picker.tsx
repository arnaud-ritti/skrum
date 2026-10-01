import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CalendarIcon, CalendarX, CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import type { CalendarLocale } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type DatePickerLocale = CalendarLocale;

export type DateShortcut = { label: string; date: Date | null };

export type DatePickerProps = {
    label: string;
    value?: Date;
    onValueChange: (date: Date | undefined) => void;
    locale: DatePickerLocale;
    weekStartsOn?: 0 | 1;
    disabled?: boolean;
    isDateDisabled?: (date: Date) => boolean;
    today?: Date;
    shortcuts?: DateShortcut[];
    allowTyping?: boolean;
    overdue?: boolean;
    error?: string;
    placeholder?: string;
    hideLabel?: boolean;
    id?: string;
    className?: string;
};

const IntlTags: Record<DatePickerLocale, string> = {
    fr: 'fr',
    en: 'en-US',
};

const TypedFormats: Record<DatePickerLocale, string> = {
    fr: 'jj/mm/aaaa',
    en: 'MM/DD/YYYY',
};

const FlashDurationMs = 1200;

export function isSameDay(first: Date, second: Date): boolean {
    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function formatShortDate(
    date: Date,
    locale: DatePickerLocale,
    today: Date,
): string {
    return new Intl.DateTimeFormat(IntlTags[locale], {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year:
            date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    }).format(date);
}

function formatLongDate(date: Date, locale: DatePickerLocale): string {
    return new Intl.DateTimeFormat(IntlTags[locale], {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);
}

function buildValidDate(
    year: number,
    monthIndex: number,
    day: number,
): Date | null {
    const date = new Date(year, monthIndex, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== monthIndex ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

const RelativeKeywords: Record<string, number> = {
    today: 0,
    "aujourd'hui": 0,
    aujourdhui: 0,
    tomorrow: 1,
    demain: 1,
    yesterday: -1,
    hier: -1,
};

export function parseTypedDate(
    text: string,
    locale: DatePickerLocale,
    today: Date,
): Date | null {
    const input = text.trim().toLowerCase();

    if (input === '') {
        return null;
    }

    if (input in RelativeKeywords) {
        return addDays(startOfDay(today), RelativeKeywords[input]);
    }

    const relative = input.match(
        /^(?:in|dans|\+)\s*(\d{1,3})\s*(day|days|jour|jours|week|weeks|semaine|semaines|j|d|w|s)?$/,
    );

    if (relative) {
        const unit = relative[2] ?? 'day';
        const isWeek = /^(w|s|week|weeks|semaine|semaines)$/.test(unit);

        return addDays(
            startOfDay(today),
            Number(relative[1]) * (isWeek ? 7 : 1),
        );
    }

    const numeric = input.match(
        /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/,
    );

    if (!numeric) {
        return null;
    }

    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const day = locale === 'fr' ? first : second;
    const month = locale === 'fr' ? second : first;
    let year = today.getFullYear();

    if (numeric[3] !== undefined) {
        year = Number(numeric[3]);

        if (numeric[3].length === 2) {
            year += 2000;
        }
    }

    return buildValidDate(year, month - 1, day);
}

function daysBetween(from: Date, to: Date): number {
    const millisecondsPerDay = 86_400_000;
    const fromUtc = Date.UTC(
        from.getFullYear(),
        from.getMonth(),
        from.getDate(),
    );
    const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());

    return Math.round((toUtc - fromUtc) / millisecondsPerDay);
}

export function DatePicker({
    label,
    value,
    onValueChange,
    locale,
    weekStartsOn,
    disabled = false,
    isDateDisabled,
    today,
    shortcuts,
    allowTyping = false,
    overdue = false,
    error,
    placeholder,
    hideLabel = false,
    id,
    className,
}: DatePickerProps) {
    const { t } = useTrans();
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');
    const [flashing, setFlashing] = useState(false);
    const lastLocalValue = useRef<Date | undefined>(value);
    const previousValue = useRef<Date | undefined>(value);
    const referenceDay = today ?? new Date();
    const typedFormat = TypedFormats[locale];

    useEffect(() => {
        const before = previousValue.current;
        previousValue.current = value;

        const unchanged =
            before === value || (before && value && isSameDay(before, value));
        const isLocal =
            lastLocalValue.current === value ||
            (lastLocalValue.current &&
                value &&
                isSameDay(lastLocalValue.current, value));

        if (unchanged || isLocal) {
            return;
        }

        setFlashing(true);
        const timer = setTimeout(() => setFlashing(false), FlashDurationMs);

        return () => clearTimeout(timer);
    }, [value]);

    const commit = (next: Date | undefined) => {
        lastLocalValue.current = next;
        onValueChange(next);
        setOpen(false);
        setTyped('');
    };

    const parsed = allowTyping
        ? parseTypedDate(typed, locale, referenceDay)
        : null;
    const parsedIsDisabled =
        parsed !== null &&
        isDateDisabled !== undefined &&
        isDateDisabled(parsed);
    const interpretation =
        typed.trim() === ''
            ? t('Type a date as :format or a word like tomorrow', {
                  format: typedFormat,
              })
            : parsed && !parsedIsDisabled
              ? t('Read as :date', { date: formatLongDate(parsed, locale) })
              : t('Not a valid date');

    const onTypedKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();

        if (parsed && !parsedIsDisabled) {
            commit(parsed);
        }
    };

    const overdueDays =
        overdue && value ? Math.max(daysBetween(value, referenceDay), 1) : 0;
    const overdueText =
        overdueDays === 1
            ? t('Overdue by :count day', { count: overdueDays })
            : t('Overdue by :count days', { count: overdueDays });
    const showOverdue = overdue && value !== undefined;

    const labelId = `${fieldId}-label`;
    const valueId = `${fieldId}-value`;
    const helpId = `${fieldId}-help`;
    const errorId = `${fieldId}-error`;
    const typedHelpId = `${fieldId}-typed-help`;
    const describedBy =
        [
            error ? errorId : undefined,
            showOverdue && !error ? helpId : undefined,
        ]
            .filter(Boolean)
            .join(' ') || undefined;

    const TriggerIcon = showOverdue ? CalendarX : CalendarIcon;

    return (
        <div
            data-slot="date-picker"
            className={cn('flex min-w-0 flex-col gap-1.5', className)}
        >
            <Label
                id={labelId}
                htmlFor={fieldId}
                className={cn(hideLabel && 'sr-only', disabled && 'opacity-55')}
            >
                {label}
            </Label>
            <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
                <PopoverPrimitive.Trigger asChild>
                    <Button
                        id={fieldId}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        data-slot="date-picker-trigger"
                        data-empty={value === undefined}
                        aria-labelledby={`${labelId} ${valueId}`}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        className={cn(
                            'h-9 w-full justify-start gap-2 px-3 text-sm font-normal data-[empty=true]:text-muted-foreground',
                            error && 'border-destructive',
                            showOverdue &&
                                'font-semibold text-skrum-destructive-text [&_svg]:text-skrum-destructive-text',
                            flashing &&
                                'bg-skrum-primary-soft text-skrum-primary-text',
                        )}
                    >
                        <TriggerIcon aria-hidden="true" />
                        <span id={valueId} className="truncate">
                            {value
                                ? formatShortDate(value, locale, referenceDay)
                                : (placeholder ?? t('Pick a date'))}
                        </span>
                    </Button>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content
                        data-slot="date-picker-content"
                        aria-label={label}
                        align="start"
                        sideOffset={4}
                        className="z-50 w-auto max-w-(--radix-popover-content-available-width) rounded-lg border bg-popover p-3 text-popover-foreground shadow-popover outline-none"
                    >
                        <div className="@container flex w-112 max-w-full flex-col gap-3">
                            {allowTyping && (
                                <div className="flex flex-col gap-1">
                                    <Input
                                        value={typed}
                                        onChange={(event) =>
                                            setTyped(event.target.value)
                                        }
                                        onKeyDown={onTypedKeyDown}
                                        placeholder={typedFormat}
                                        aria-label={t('Type a date')}
                                        aria-describedby={typedHelpId}
                                        aria-invalid={
                                            typed.trim() !== '' &&
                                            (parsed === null ||
                                                parsedIsDisabled)
                                                ? true
                                                : undefined
                                        }
                                        autoComplete="off"
                                    />
                                    <p
                                        id={typedHelpId}
                                        aria-live="polite"
                                        className="text-body-sm text-muted-foreground"
                                    >
                                        {interpretation}
                                    </p>
                                </div>
                            )}
                            <div className="flex flex-col gap-3 @md:flex-row">
                                {shortcuts && shortcuts.length > 0 && (
                                    <div
                                        data-slot="date-picker-shortcuts"
                                        className="flex flex-wrap gap-1 @md:w-32 @md:shrink-0 @md:flex-col @md:flex-nowrap @md:gap-0.5 @md:border-r @md:pr-3"
                                    >
                                        {shortcuts.map((shortcut) => {
                                            const active =
                                                shortcut.date === null
                                                    ? value === undefined
                                                    : value !== undefined &&
                                                      isSameDay(
                                                          shortcut.date,
                                                          value,
                                                      );

                                            return (
                                                <button
                                                    key={shortcut.label}
                                                    type="button"
                                                    data-active={active}
                                                    aria-pressed={active}
                                                    onClick={() =>
                                                        commit(
                                                            shortcut.date ??
                                                                undefined,
                                                        )
                                                    }
                                                    className="flex min-w-0 flex-col items-start rounded-sm border px-2 py-1 text-left text-sm transition-colors duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-skrum-primary-soft data-[active=true]:text-skrum-primary-text motion-reduce:transition-none @md:border-transparent"
                                                >
                                                    <span className="w-full truncate">
                                                        {shortcut.label}
                                                    </span>
                                                    {shortcut.date && (
                                                        <span className="hidden w-full truncate text-xs text-muted-foreground @md:block">
                                                            {formatShortDate(
                                                                shortcut.date,
                                                                locale,
                                                                referenceDay,
                                                            )}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <Calendar
                                    mode="single"
                                    required
                                    selected={value}
                                    onSelect={(date) => commit(date)}
                                    locale={locale}
                                    weekStartsOn={weekStartsOn}
                                    disabled={isDateDisabled}
                                    today={today}
                                    defaultMonth={value ?? referenceDay}
                                />
                            </div>
                        </div>
                    </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
            {showOverdue && !error && (
                <span
                    id={helpId}
                    data-slot="field-description"
                    className="text-body-sm text-skrum-destructive-text"
                >
                    {overdueText}
                </span>
            )}
            {error && (
                <span
                    id={errorId}
                    data-slot="field-error"
                    className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text"
                >
                    <CircleAlert
                        className="size-4 shrink-0"
                        aria-hidden="true"
                    />
                    {error}
                </span>
            )}
        </div>
    );
}
