import { useState } from 'react';
import { MoodTrendChart } from '@/components/skrum/mood-trend-chart';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { useLastDefined } from '@/hooks/use-last-defined';
import { useTrans } from '@/hooks/use-trans';
import {
    deltaSincePrevious,
    moodScale,
    preferredMetric,
    toMoodPoints,
} from '@/lib/teams/mood-adapter';
import type { MoodMetric } from '@/lib/teams/mood-adapter';
import type { TeamMoodPoint } from '@/types';

type Props = {
    /** Deferred: undefined until the server has answered. */
    trend?: TeamMoodPoint[];
};

/** Mood (health check score) and ROTI of the team across its last retros. */
export function TeamMoodCard({ trend }: Props) {
    const { t } = useTrans();
    const [chosenMetric, setChosenMetric] = useState<MoodMetric>();
    const shownTrend = useLastDefined(trend);

    if (shownTrend === undefined) {
        return <TeamMoodSkeleton />;
    }

    const metric = chosenMetric ?? preferredMetric(shownTrend);
    const points = toMoodPoints(shownTrend, metric);

    return (
        <div data-slot="team-mood" data-metric={metric} className="min-w-0">
            <MoodTrendChart
                title={t('Mood trend')}
                headingLevel={2}
                points={points}
                period="retro"
                scale={moodScale(metric)}
                metricLabel={
                    metric === 'mood' ? t('Health score') : t('Average ROTI')
                }
                deltaSincePrevious={deltaSincePrevious(points)}
                emptyLabel={
                    metric === 'mood'
                        ? t('No health check results yet.')
                        : t('No ROTI results yet.')
                }
                controls={
                    <Tabs
                        value={metric}
                        onValueChange={setChosenMetric}
                        items={[
                            { value: 'mood', label: t('Mood') },
                            { value: 'roti', label: t('ROTI') },
                        ]}
                        aria-label={t('Value shown')}
                        className="w-auto"
                    />
                }
            />
        </div>
    );
}

function TeamMoodSkeleton() {
    const { t } = useTrans();

    return (
        <Card data-slot="team-mood-loading" aria-busy className="gap-4 p-5">
            <span role="status" className="sr-only">
                {t('Loading chart')}
            </span>
            <div aria-hidden className="flex flex-col gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton aria-hidden className="h-9 w-full" />
            <Skeleton aria-hidden className="h-72 w-full" />
            <Skeleton aria-hidden className="h-4 w-40" />
        </Card>
    );
}
