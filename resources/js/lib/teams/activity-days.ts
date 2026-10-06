import type { Translate } from '@/hooks/use-trans';
import { calendarDay } from '@/lib/teams/sprint';
import type { TeamActivityLine } from '@/types';

export type ActivityDay = {
    day: string;
    label: string;
    lines: TeamActivityLine[];
};

/** The `Y-m-d` day before a `Y-m-d` day. */
export function dayBefore(day: string): string {
    const date = calendarDay(day);

    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
}

function dayLabel(
    day: string,
    today: string,
    locale: string,
    t: Translate,
): string {
    if (day === today) {
        return t('Today');
    }

    if (day === dayBefore(today)) {
        return t('Yesterday');
    }

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
        timeZone: 'UTC',
    }).format(calendarDay(day));
}

/**
 * The lines under one heading per day, in the order they came. `today` and
 * each line's day are days of the application's time zone, sent by the
 * server: the viewer's clock decides neither.
 */
export function groupByDay(
    lines: TeamActivityLine[],
    today: string,
    locale: string,
    t: Translate,
): ActivityDay[] {
    const groups = new Map<string, ActivityDay>();

    for (const line of lines) {
        const group = groups.get(line.day);

        if (group === undefined) {
            groups.set(line.day, {
                day: line.day,
                label: dayLabel(line.day, today, locale, t),
                lines: [line],
            });

            continue;
        }

        group.lines.push(line);
    }

    return [...groups.values()];
}
