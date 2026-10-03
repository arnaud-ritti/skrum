import { MoodTrendChart } from '@/components/skrum/mood-trend-chart';
import { TrendError, TrendSkeleton } from '@/components/teams/trend-states';
import type { TrendState } from '@/components/teams/trend-states';
import { useTrans } from '@/hooks/use-trans';
import {
    deltaSincePrevious,
    healthScale,
    toMoodPoints,
} from '@/lib/teams/mood-adapter';

/**
 * The mood of the team (its health check score) across its last health checks,
 * those of its retros and those run as surveys, as a chart and as a table
 * that names the kind of each, on the health check page.
 */
export function TeamMoodCard({ trend, failed = false, onRetry }: TrendState) {
    const { t } = useTrans();

    if (failed) {
        return <TrendError title={t('Mood trend')} onRetry={onRetry} />;
    }

    if (trend === undefined) {
        return <TrendSkeleton />;
    }

    const points = toMoodPoints(trend, {
        retro: t('Retro'),
        survey: t('Survey'),
    });

    return (
        <div data-slot="team-mood" className="min-w-0">
            <MoodTrendChart
                title={t('Mood trend')}
                headingLevel={2}
                points={points}
                period="retro"
                scale={healthScale}
                metricLabel={t('Health score')}
                deltaSincePrevious={deltaSincePrevious(points)}
                emptyLabel={t('No health check results yet.')}
            />
        </div>
    );
}
