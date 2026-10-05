import { calendarDay } from '@/lib/teams/sprint';
import type { NextRetro, Sprint } from '@/types';

type SprintDays = Pick<Sprint, 'id' | 'startsOn' | 'endsOn'>;

export type SprintDraft = { number: number; startsOn: string; endsOn: string };

/** The `Y-m-d` day and `H:i` clock of a moment in a time zone (the app's, as the server reads it). */
export function zonedNow(
    moment: Date,
    timeZone: string,
): { day: string; clock: string } {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        })
            .formatToParts(moment)
            .map((part) => [part.type, part.value]),
    );

    return {
        day: `${parts.year}-${parts.month}-${parts.day}`,
        clock: `${parts.hour}:${parts.minute}`,
    };
}

export function addDays(day: string, days: number): string {
    const date = calendarDay(day);

    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
}

function isoWeekday(day: string): number {
    const weekday = calendarDay(day).getUTCDay();

    return weekday === 0 ? 7 : weekday;
}

/** The last day of the retro weekday within the sprint's days, or null when the sprint has none. */
function retroDayOf(sprint: SprintDays, retroWeekday: number): string | null {
    const back = (isoWeekday(sprint.endsOn) - retroWeekday + 7) % 7;
    const retroDay = addDays(sprint.endsOn, -back);

    if (retroDay < sprint.startsOn) {
        return null;
    }

    return retroDay;
}

/**
 * The next retro the rituals form would give, read as `SprintCalendar::nextRetro`
 * does: among the current sprint and the next one, the last retro weekday of
 * each that is not past yet.
 */
export function previewNextRetro(
    sprints: SprintDays[],
    retroWeekday: number | null,
    retroTime: string | null,
    now: Date,
    timeZone: string,
): NextRetro | null {
    if (retroWeekday === null) {
        return null;
    }

    const { day: today, clock } = zonedNow(now, timeZone);
    const coming = sprints
        .filter((sprint) => sprint.endsOn >= today)
        .sort(
            (first, second) =>
                first.startsOn.localeCompare(second.startsOn) ||
                first.id.localeCompare(second.id),
        )
        .slice(0, 2);

    for (const sprint of coming) {
        const retroDay = retroDayOf(sprint, retroWeekday);

        if (retroDay === null || retroDay < today) {
            continue;
        }

        if (retroDay === today && retroTime !== null && clock > retroTime) {
            continue;
        }

        return { date: retroDay, time: retroTime };
    }

    return null;
}

/** "Add a sprint": the next number, from the day after the latest sprint (today without one), for the default length. */
export function newSprintDefaults(
    latestFirst: SprintDays[],
    number: number,
    lengthWeeks: number,
    today: string,
): SprintDraft {
    const latest = latestFirst[0];
    const startsOn = latest === undefined ? today : addDays(latest.endsOn, 1);

    return {
        number,
        startsOn,
        endsOn: addDays(startsOn, lengthWeeks * 7 - 1),
    };
}
