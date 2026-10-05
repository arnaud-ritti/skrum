const DayMs = 86_400_000;

/** Each unit, the days from which it is used and the days it counts: a year from 360 days, never "12 months". */
const DayUnits: Array<[Intl.RelativeTimeFormatUnit, number, number]> = [
    ['year', 360, 365],
    ['month', 30, 30],
    ['week', 7, 7],
    ['day', 1, 1],
];

function startOfDay(time: number): number {
    const day = new Date(time);

    day.setHours(0, 0, 0, 0);

    return day.getTime();
}

/** "3 days ago", "2 weeks ago", "today": a date told to the day; nothing for a date that does not parse. */
export function formatDaysAgo(
    iso: string,
    locale: string,
    now: number,
): string {
    const time = Date.parse(iso);

    if (Number.isNaN(time)) {
        return '';
    }

    const days = Math.max(
        0,
        Math.round((startOfDay(now) - startOfDay(time)) / DayMs),
    );
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const [unit, from, size] of DayUnits) {
        if (days >= from) {
            return formatter.format(
                -Math.max(1, Math.floor(days / size)),
                unit,
            );
        }
    }

    return formatter.format(0, 'day');
}
