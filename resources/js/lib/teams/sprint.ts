import type { NextRetro, Sprint } from '@/types';

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

/** A `Y-m-d` day as a date at midnight UTC, so that formatting never shifts it by the viewer's time zone. */
export function calendarDay(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day));
}

export function formatDay(date: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(calendarDay(date));
}

/** "2 PM", "14 h": the hour alone on the hour, unless the locale writes it as a bare number. */
export function formatTime(time: string, locale: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const at = new Date(Date.UTC(2000, 0, 1, hours, minutes));
    const withMinutes = new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    }).format(at);

    if (minutes !== 0) {
        return withMinutes;
    }

    const hourOnly = new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        timeZone: 'UTC',
    }).format(at);

    return /^\d+$/.test(hourOnly) ? withMinutes : hourOnly;
}

export function formatShortDay(date: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(calendarDay(date));
}

export function sprintTitle(
    sprint: Pick<Sprint, 'number'>,
    t: Translate,
): string {
    return t('Sprint :number', { number: sprint.number });
}

/** "21 Sep → 4 Oct" */
export function sprintRange(
    sprint: Pick<Sprint, 'startsOn' | 'endsOn'>,
    locale: string,
): string {
    return `${formatShortDay(sprint.startsOn, locale)} → ${formatShortDay(sprint.endsOn, locale)}`;
}

export function nextRetroLabel(
    next: NextRetro,
    locale: string,
    t: Translate,
): string {
    const date = formatDay(next.date, locale);

    if (next.time === null) {
        return t('Next retro :date', { date });
    }

    return t('Next retro :date, :time', {
        date,
        time: formatTime(next.time, locale),
    });
}

/** The name the retro form proposes: "Sprint 42 retro", or nothing outside every sprint. */
export function retroNamePrefill(
    sprintNumber: number | null,
    t: Translate,
): string | undefined {
    if (sprintNumber === null) {
        return undefined;
    }

    return t('Sprint :number retro', { number: sprintNumber });
}
