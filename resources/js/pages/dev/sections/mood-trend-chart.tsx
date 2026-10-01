import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { MoodTrendChart } from '@/components/skrum/mood-trend-chart';
import type { MoodPoint } from '@/components/skrum/mood-trend-chart';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const means = [3.1, 3.4, 2.6, 3.0, 3.5, 3.7, 3.4, 3.8];
const spreads: [number, number][] = [
    [2.2, 4.0],
    [2.4, 4.3],
    [1.8, 3.4],
    [2.3, 3.9],
    [2.6, 4.3],
    [2.8, 4.5],
    [2.6, 4.1],
    [3.0, 4.6],
];

function buildPoints(from: number, count: number): MoodPoint[] {
    return Array.from({ length: count }, (_, index) => {
        const source = index % means.length;

        return {
            sprint: `S${from + index}`,
            mean: means[source],
            q1: spreads[source][0],
            q3: spreads[source][1],
            voters: 9 + ((index * 5) % 4),
        };
    });
}

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

export default function MoodTrendChartSection() {
    const { t } = useTrans();
    const longHistory = buildPoints(31, 12);
    const eightSprints = buildPoints(35, 8);
    const annotations = [
        {
            sprint: 'S37',
            title: t('Hard release on June 12'),
            detail: t('3 actions created, all done in S38'),
        },
    ];

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <State label={t('Default · 8 sprints with annotation')}>
                <MoodTrendChart
                    team="Atlas"
                    points={longHistory}
                    annotations={annotations}
                />
            </State>
            <State label={t('Hover on a sprint (crosshair and tooltip)')}>
                <MoodTrendChart
                    team="Atlas"
                    points={eightSprints}
                    annotations={annotations}
                    defaultActiveSprint="S41"
                />
            </State>
            <State label={t('Period · 4 sprints')}>
                <MoodTrendChart
                    team="Atlas"
                    points={longHistory}
                    range="4"
                    onRangeChange={() => {}}
                />
            </State>
            <State label={t('Period · all sprints')}>
                <MoodTrendChart
                    team="Atlas"
                    points={longHistory}
                    range="all"
                    onRangeChange={() => {}}
                />
            </State>
            <State label={t('Little data · fewer than 3 sprints')}>
                <MoodTrendChart team="Atlas" points={buildPoints(41, 2)} />
            </State>
            <State label={t('No data')}>
                <MoodTrendChart team="Atlas" points={[]} />
            </State>
            <State label={t('Table view')}>
                <MoodTrendChart
                    team="Atlas"
                    points={eightSprints}
                    defaultView="table"
                />
            </State>
            <State label={t('Narrow container · 20rem')}>
                <div className="w-80 max-w-full">
                    <MoodTrendChart
                        team="Atlas"
                        points={longHistory}
                        annotations={annotations}
                        height={240}
                    />
                </div>
            </State>
        </div>
    );
}
