import type { MoodPoint, MoodScale } from '@/components/skrum/mood-trend-chart';
import type { RotiTrendPoint } from '@/components/skrum/roti-trend-card';
import type { TeamMoodPoint } from '@/types';

/**
 * Health is read on 1 to 5; the axis starts at 0 because an old score on ten,
 * read halved, can be under 1.
 */
export const healthScale: MoodScale = { min: 0, max: 5 };

export type MoodKindLabels = { retro: string; survey: string };

/**
 * One point per health check that has a score, in the order received (oldest
 * first): the one of a retro, or one run as a survey, which links to its results.
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
 * The product has no sprint number: the axis shows the day the retro closed.
 */
export function toRotiPoints(
    trend: TeamMoodPoint[],
    locale?: string,
): RotiTrendPoint[] {
    const day = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    });

    return trend.flatMap((retro) => {
        if (retro.roti === null) {
            return [];
        }

        return [
            {
                id: retro.retroId ?? retro.url,
                label: day.format(new Date(retro.completedAt)),
                title: retro.title,
                mean: retro.roti,
            },
        ];
    });
}

/** Change of the last point since the one before it; null under two points. */
export function deltaSincePrevious(points: MoodPoint[]): number | null {
    const last = points.at(-1);
    const previous = points.at(-2);

    if (last === undefined || previous === undefined) {
        return null;
    }

    return Math.round((last.mean - previous.mean) * 10) / 10;
}
