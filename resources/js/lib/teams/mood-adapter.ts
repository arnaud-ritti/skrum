import type { MoodPoint, MoodScale } from '@/components/skrum/mood-trend-chart';
import type { TeamMoodPoint } from '@/types';

export type MoodMetric = 'mood' | 'roti';

/**
 * A health check answer goes from 1 to 10; the axis starts at 0 so that its
 * ticks are whole numbers.
 */
const healthScale: MoodScale = { min: 0, max: 10 };

/** One point per retro that has the value, in the order received (oldest first). */
export function toMoodPoints(
    trend: TeamMoodPoint[],
    metric: MoodMetric,
): MoodPoint[] {
    return trend.flatMap((retro) => {
        const mean = metric === 'mood' ? retro.mood : retro.roti;

        if (mean === null) {
            return [];
        }

        return [
            {
                id: retro.retroId,
                sprint: retro.title,
                mean,
                voters: metric === 'mood' ? retro.moodVoters : retro.rotiVoters,
                href: retro.url,
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

/** `undefined` is the chart's own ROTI scale, 1 to 5 with its coloured levels. */
export function moodScale(metric: MoodMetric): MoodScale | undefined {
    return metric === 'mood' ? healthScale : undefined;
}

/** The tab shown first: the mood, unless only the ROTI has data. */
export function preferredMetric(trend: TeamMoodPoint[]): MoodMetric {
    const hasMood = trend.some((retro) => retro.mood !== null);
    const hasRoti = trend.some((retro) => retro.roti !== null);

    return !hasMood && hasRoti ? 'roti' : 'mood';
}
