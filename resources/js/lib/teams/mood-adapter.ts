import type { MoodPoint, MoodScale } from '@/components/skrum/mood-trend-chart';
import type { RotiTrendPoint } from '@/components/skrum/roti-trend-card';
import type { TeamMoodPoint } from '@/types';

/** Health is given and read on 1 to 5 (`HealthScale`). */
export const healthScale: MoodScale = { min: 1, max: 5 };

/** Under this score the team's mood needs attention (`HealthScale::band`). */
export const healthThreshold = 3;

export type MoodKindLabels = { retro: string; survey: string };

/**
 * One point per health check that has a score, in the order received (oldest
 * first), with its spread: the one of a retro, or one run as a survey, which
 * links to its results.
 * With labels, each point names its kind for the table view.
 */
export function toMoodPoints(
    trend: TeamMoodPoint[],
    kindLabels?: MoodKindLabels,
): MoodPoint[] {
    return trend.flatMap((entry) => {
        if (entry.mood === null) {
            return [];
        }

        const point: MoodPoint = {
            id: entry.surveyId ?? entry.retroId ?? entry.url,
            sprint: entry.title,
            mean: entry.mood,
            voters: entry.moodVoters,
            href: entry.url,
            ...(entry.moodQ1 !== null &&
                entry.moodQ3 !== null && {
                    q1: entry.moodQ1,
                    q3: entry.moodQ3,
                }),
        };

        if (kindLabels === undefined) {
            return [point];
        }

        return [
            {
                ...point,
                kind:
                    entry.retroId === null
                        ? kindLabels.survey
                        : kindLabels.retro,
            },
        ];
    });
}

/**
 * One point per retro that has a ROTI, in the order received (oldest first).
 * The axis names the sprint of each retro ("S35") when every one of them was
 * created inside a sprint, the day it closed otherwise.
 */
export function toRotiPoints(
    trend: TeamMoodPoint[],
    locale?: string,
): RotiTrendPoint[] {
    const day = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    });
    const retros = trend.filter(
        (retro): retro is TeamMoodPoint & { roti: number } =>
            retro.roti !== null,
    );
    const bySprint = retros.every((retro) => Boolean(retro.sprintLabel));

    return retros.map((retro) => ({
        id: retro.retroId ?? retro.url,
        label:
            bySprint && retro.sprintLabel
                ? retro.sprintLabel
                : day.format(new Date(retro.completedAt)),
        title: retro.title,
        mean: retro.roti,
    }));
}

/** Change of the last point since the one before it; null under two points. */
export function deltaSincePrevious<Point extends { mean: number }>(
    points: Point[],
): number | null {
    const last = points.at(-1);
    const previous = points.at(-2);

    if (last === undefined || previous === undefined) {
        return null;
    }

    return Math.round((last.mean - previous.mean) * 10) / 10;
}
