const DayMs = 86_400_000;

const DayUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365],
    ['month', 30],
    ['week', 7],
    ['day', 1],
];

function startOfDay(time: number): number {
    const day = new Date(time);

    day.setHours(0, 0, 0, 0);

    return day.getTime();
}

/** "3 days ago", "2 weeks ago", "today": a date told to the day. */
export function formatDaysAgo(
    iso: string,
    locale: string,
    now: number,
): string {
    const days = Math.max(
        0,
        Math.round((startOfDay(now) - startOfDay(Date.parse(iso))) / DayMs),
    );
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const [unit, size] of DayUnits) {
        if (days >= size) {
            return formatter.format(-Math.floor(days / size), unit);
        }
    }

    return formatter.format(0, 'day');
}
