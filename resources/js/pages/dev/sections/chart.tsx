import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { TeamChart } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

const sprints = ['S38', 'S39', 'S40', 'S41', 'S42', 'S43'];
const created = [9, 7, 11, 8, 10, 5];
const done = [7, 7, 8, 6, 9, 2];
const committed = [24, 26, 22, 28, 25, 27];
const delivered = [21, 25, 20, 24, 25, 12];

export default function ChartSection() {
    const { t } = useTrans();

    const actionsConfig = {
        created: { label: t('Created'), color: 'var(--chart-1)' },
        done: { label: t('Done'), color: 'var(--chart-2)' },
    } satisfies ChartConfig;

    const pointsConfig = {
        committed: { label: t('Committed'), color: 'var(--chart-3)' },
        delivered: { label: t('Delivered'), color: 'var(--chart-1)' },
    } satisfies ChartConfig;

    const fiveConfig = {
        a: { label: t('Series 1'), color: 'var(--chart-1)' },
        b: { label: t('Series 2'), color: 'var(--chart-2)' },
        c: { label: t('Series 3'), color: 'var(--chart-3)' },
        d: { label: t('Series 4'), color: 'var(--chart-4)' },
        e: { label: t('Series 5'), color: 'var(--chart-5)' },
    } satisfies ChartConfig;

    const actionsData = sprints.map((sprint, index) => ({
        sprint,
        created: created[index],
        done: done[index],
    }));

    const pointsData = sprints.map((sprint, index) => ({
        sprint,
        committed: committed[index],
        delivered: delivered[index],
    }));

    const fiveData = sprints.map((sprint, index) => ({
        sprint,
        a: 4 + index,
        b: 6,
        c: 9 - index,
        d: 3 + (index % 3),
        e: 7,
    }));

    const manyData = Array.from({ length: 200 }, (_, index) => ({
        sprint: `S${index + 1}`,
        created: 5 + ((index * 7) % 9),
        done: 4 + ((index * 5) % 8),
    }));

    return (
        <div className="grid grid-cols-1 gap-8 p-4 md:p-6 lg:grid-cols-2">
            <Example
                label={t(
                    'Grouped bars (rest; hover or arrow keys show the tooltip)',
                )}
            >
                <TeamChart
                    title={t('Actions per sprint')}
                    description={t('Created vs done, last 6 sprints')}
                    data={actionsData}
                    config={actionsConfig}
                    kind="bar"
                    xKey="sprint"
                    animated={false}
                />
            </Example>
            <Example label={t('Lines')}>
                <TeamChart
                    title={t('Story points')}
                    description={t('Committed vs delivered, last 6 sprints')}
                    data={pointsData}
                    config={pointsConfig}
                    kind="line"
                    xKey="sprint"
                    unit="pts"
                    animated={false}
                />
            </Example>
            <Example
                label={t('Current period (S43: delivered line interrupted)')}
            >
                <TeamChart
                    title={t('Story points')}
                    description={t('Committed vs delivered, last 6 sprints')}
                    data={pointsData}
                    config={pointsConfig}
                    kind="line"
                    xKey="sprint"
                    unit="pts"
                    currentPeriod="S43"
                    animated={false}
                />
            </Example>
            <Example label={t('Current period on bars')}>
                <TeamChart
                    title={t('Actions per sprint')}
                    description={t('Created vs done, last 6 sprints')}
                    data={actionsData}
                    config={actionsConfig}
                    kind="bar"
                    xKey="sprint"
                    currentPeriod="S43"
                    animated={false}
                />
            </Example>
            <Example
                label={t('Five series, fixed colour order chart-1 to chart-5')}
            >
                <TeamChart
                    title={t('Five series')}
                    description={t('Palette order check')}
                    data={fiveData}
                    config={fiveConfig}
                    kind="bar"
                    xKey="sprint"
                    animated={false}
                />
            </Example>
            <Example label={t('Empty')}>
                <TeamChart
                    title={t('Actions per sprint')}
                    description={t('Created vs done')}
                    data={[]}
                    config={actionsConfig}
                    kind="bar"
                    xKey="sprint"
                    animated={false}
                />
            </Example>
            <Example label={t('Loading')}>
                <TeamChart
                    title={t('Actions per sprint')}
                    description={t('Created vs done')}
                    data={[]}
                    config={actionsConfig}
                    kind="bar"
                    xKey="sprint"
                    loading
                    animated={false}
                />
            </Example>
            <Example label={t('Single period')}>
                <TeamChart
                    title={t('Actions per sprint')}
                    description={t('Created vs done')}
                    data={actionsData.slice(0, 1)}
                    config={actionsConfig}
                    kind="line"
                    xKey="sprint"
                    animated={false}
                />
            </Example>
            <Example label={t('200 periods')}>
                <TeamChart
                    title={t('Actions per sprint')}
                    description={t('Created vs done')}
                    data={manyData}
                    config={actionsConfig}
                    kind="line"
                    xKey="sprint"
                    animated={false}
                />
            </Example>
        </div>
    );
}
