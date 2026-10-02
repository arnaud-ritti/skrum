import type { MoodPoint, MoodScale } from '@/components/skrum/mood-trend-chart';
import type { RotiTrendPoint } from '@/components/skrum/roti-trend-card';
import type { TeamMoodPoint } from '@/types';

/**
 * A health check answer goes from 1 to 10; the axis starts at 0 so that its
 * ticks are whole numbers.
 */
export const healthScale: MoodScale = { min: 0, max: 10 };

/** One point per retro that has a health score, in the order received (oldest first). */
export function toMoodPoints(trend: TeamMoodPoint[]): MoodPoint[] {
    return trend.flatMap((retro) => {
        if (retro.mood === null) {
            return [];
        }

        return [
            {
                id: retro.retroId,
                sprint: retro.title,
                mean: retro.mood,
                voters: retro.moodVoters,
                href: retro.url,
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
                id: retro.retroId,
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
