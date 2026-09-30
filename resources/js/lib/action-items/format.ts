/**
 * Due dates have no time part; formatting them in UTC keeps the day the
 * user picked whatever the browser's time zone.
 */
export function formatDueDate(dueOn: string, locale: string): string {
    const [year, month, day] = dueOn.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatShortDate(iso: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        new Date(iso),
    );
}

const RelativeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
];

export function formatRelativeTime(
    iso: string,
    locale: string,
    now: number,
): string {
    const elapsed = new Date(iso).getTime() - now;
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const [unit, size] of RelativeUnits) {
        if (Math.abs(elapsed) >= size) {
            return formatter.format(Math.round(elapsed / size), unit);
        }
    }

    return formatter.format(0, 'minute');
}
