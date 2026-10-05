import {
    CalendarIcon,
    CalendarRange,
    CalendarX,
    CircleAlert,
    X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type DatePickerLocale = 'fr' | 'en';

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
    hoy: 0,
    mañana: 1,
    manana: 1,
    ayer: -1,
    heute: 0,
    morgen: 1,
    gestern: -1,
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
        /^(?:in|dans|en|\+)\s*(\d{1,3})\s*(day|days|jour|jours|días|dias|día|dia|tag|tage|tagen|week|weeks|semaine|semaines|semana|semanas|woche|wochen|j|d|w|s)?$/,
    );

    if (relative) {
        const unit = relative[2] ?? 'day';
        const isWeek =
            /^(w|s|week|weeks|semaine|semaines|semana|semanas|woche|wochen)$/.test(
                unit,
            );

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
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
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
                </PopoverTrigger>
                <PopoverContent
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
                                        (parsed === null || parsedIsDisabled)
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
                </PopoverContent>
            </Popover>
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

export type DateRangeValue = { from: Date; to: Date };

export type DateRangePreset = { label: string; range: DateRangeValue };

export type DateRangeFilterProps = {
    label: string;
    value?: DateRangeValue;
    presets?: DateRangePreset[];
    /** Called by Apply with the chosen range, or with nothing once cleared. */
    onApply: (range?: DateRangeValue) => void;
    locale: DatePickerLocale;
    weekStartsOn?: 0 | 1;
    isDateDisabled?: (date: Date) => boolean;
    today?: Date;
    defaultOpen?: boolean;
    className?: string;
};

export function formatShortRange(
    range: DateRangeValue,
    locale: DatePickerLocale,
    today: Date,
): string {
    const isCurrentYear =
        range.from.getFullYear() === today.getFullYear() &&
        range.to.getFullYear() === today.getFullYear();

    return new Intl.DateTimeFormat(IntlTags[locale], {
        day: 'numeric',
        month: 'short',
        year: isCurrentYear ? undefined : 'numeric',
    }).formatRange(range.from, range.to);
}

function completeRange(draft: DateRange | undefined): DateRangeValue | null {
    if (!draft?.from) {
        return null;
    }

    return { from: draft.from, to: draft.to ?? draft.from };
}

export function DateRangeFilter({
    label,
    value,
    presets,
    onApply,
    locale,
    weekStartsOn,
    isDateDisabled,
    today,
    defaultOpen = false,
    className,
}: DateRangeFilterProps) {
    const { t } = useTrans();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const focusTriggerOnce = useRef(false);
    const referenceDay = today ?? new Date();
    const [open, setOpen] = useState(defaultOpen);
    const [draft, setDraft] = useState<DateRange | undefined>(value);
    const [month, setMonth] = useState<Date>(value?.from ?? referenceDay);
    const hasValue = value !== undefined;
    const chosen = completeRange(draft);
    const selectedDays =
        chosen === null ? 0 : daysBetween(chosen.from, chosen.to) + 1;
    const removeLabel = t('Remove the :label filter', { label });

    useEffect(() => {
        if (focusTriggerOnce.current && !hasValue) {
            focusTriggerOnce.current = false;
            triggerRef.current?.focus();
        }
    }, [hasValue]);

    const changeOpen = (next: boolean) => {
        if (next) {
            setDraft(value);
            setMonth(value?.from ?? referenceDay);
        }

        setOpen(next);
    };

    const apply = () => {
        onApply(chosen ?? undefined);
        setOpen(false);
    };

    const remove = () => {
        focusTriggerOnce.current = true;
        setOpen(false);
        onApply(undefined);
    };

    const countLabel =
        selectedDays === 0
            ? t('No date selected')
            : selectedDays === 1
              ? t('1 day selected')
              : t(':count days selected', { count: selectedDays });

    return (
        <Popover open={open} onOpenChange={changeOpen}>
            <span
                data-slot="date-range-filter"
                data-active={hasValue}
                className={cn(
                    'inline-flex h-8 max-w-full min-w-0 items-center rounded-md border text-body-sm font-semibold',
                    hasValue
                        ? 'border-primary/45 bg-skrum-primary-soft text-skrum-primary-text'
                        : 'border-input bg-card text-foreground hover:bg-accent',
                    className,
                )}
            >
                <PopoverTrigger asChild>
                    <button
                        ref={triggerRef}
                        type="button"
                        data-slot="date-range-filter-trigger"
                        className={cn(
                            'inline-flex h-full min-w-0 items-center gap-1.5 rounded-md pr-2 pl-3 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            !hasValue && 'pr-3',
                        )}
                    >
                        <CalendarRange
                            className="size-4 shrink-0"
                            aria-hidden="true"
                        />
                        <span className="truncate">
                            {hasValue
                                ? t(':label: :value', {
                                      label,
                                      value: formatShortRange(
                                          value,
                                          locale,
                                          referenceDay,
                                      ),
                                  })
                                : label}
                        </span>
                    </button>
                </PopoverTrigger>
                {hasValue && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={removeLabel}
                                data-slot="date-range-filter-remove"
                                onClick={remove}
                                className="grid h-full w-7 shrink-0 place-items-center rounded-r-md border-l border-primary/30 outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="size-3.5" aria-hidden="true" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>{removeLabel}</TooltipContent>
                    </Tooltip>
                )}
            </span>
            <PopoverContent
                data-slot="date-range-filter-content"
                aria-label={label}
                align="start"
                sideOffset={4}
                className="z-50 w-auto max-w-(--radix-popover-content-available-width) rounded-lg border bg-popover p-3 text-popover-foreground shadow-popover outline-none"
            >
                <div className="@container flex w-112 max-w-full flex-col gap-3">
                    <div className="flex flex-col gap-3 @md:flex-row">
                        {presets && presets.length > 0 && (
                            <div
                                data-slot="date-range-filter-presets"
                                className="flex flex-wrap gap-1 @md:w-32 @md:shrink-0 @md:flex-col @md:flex-nowrap @md:gap-0.5 @md:border-r @md:pr-3"
                            >
                                {presets.map((preset) => {
                                    const active =
                                        chosen !== null &&
                                        isSameDay(
                                            preset.range.from,
                                            chosen.from,
                                        ) &&
                                        isSameDay(preset.range.to, chosen.to);

                                    return (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            data-active={active}
                                            aria-pressed={active}
                                            onClick={() => {
                                                setDraft(preset.range);
                                                setMonth(preset.range.from);
                                            }}
                                            className="flex min-w-0 flex-col items-start rounded-sm border px-2 py-1 text-left text-sm transition-colors duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-skrum-primary-soft data-[active=true]:text-skrum-primary-text motion-reduce:transition-none @md:border-transparent"
                                        >
                                            <span className="w-full truncate">
                                                {preset.label}
                                            </span>
                                            <span className="hidden w-full truncate text-xs text-muted-foreground @md:block">
                                                {formatShortRange(
                                                    preset.range,
                                                    locale,
                                                    referenceDay,
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <Calendar
                            mode="range"
                            selected={draft}
                            onSelect={setDraft}
                            locale={locale}
                            weekStartsOn={weekStartsOn}
                            disabled={isDateDisabled}
                            today={today}
                            month={month}
                            onMonthChange={setMonth}
                        />
                    </div>
                    <div
                        data-slot="date-range-filter-footer"
                        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t pt-3"
                    >
                        <span
                            aria-live="polite"
                            className="text-xs text-muted-foreground"
                        >
                            {countLabel}
                        </span>
                        <span className="flex max-w-full min-w-0 gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-w-0"
                                disabled={chosen === null}
                                onClick={() => setDraft(undefined)}
                            >
                                <span className="truncate">{t('Clear')}</span>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="min-w-0"
                                onClick={apply}
                            >
                                <span className="truncate">{t('Apply')}</span>
                            </Button>
                        </span>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
