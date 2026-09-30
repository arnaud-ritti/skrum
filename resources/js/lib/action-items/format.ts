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
