import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function SliderSection() {
    const { t } = useTrans();
    const [single, setSingle] = useState([8]);
    const [range, setRange] = useState([4, 12]);
    const minutes = (value: number) => t(':count min', { count: value });

    return (
        <section className="@container grid gap-4 p-4 md:grid-cols-2 md:p-6">
            <State label={t('Slider: single value')}>
                <Slider
                    label={t('Phase duration')}
                    value={single}
                    onValueChange={setSingle}
                    min={1}
                    max={20}
                    format={minutes}
                    showBounds
                />
            </State>
            <State
                label={t(
                    'Slider: keyboard focus with value bubble (Tab to the handle)',
                )}
            >
                <Slider
                    label={t('Votes per participant')}
                    value={[3]}
                    onValueChange={() => {}}
                    min={1}
                    max={10}
                    showBounds
                />
            </State>
            <State label={t('Slider: range with two handles')}>
                <Slider
                    label={t('Team size')}
                    value={range}
                    onValueChange={setRange}
                    min={2}
                    max={30}
                    showBounds
                />
            </State>
            <State label={t('Slider: disabled')}>
                <Slider
                    label={t('Phase duration')}
                    value={[10]}
                    onValueChange={() => {}}
                    min={1}
                    max={20}
                    format={minutes}
                    showBounds
                    disabled
                />
            </State>
            <State label={t('Progress: 0 percent')}>
                <Progress
                    label={t('Participants who voted')}
                    value={0}
                    max={9}
                    valueLabel="0 / 9"
                />
            </State>
            <State label={t('Progress: partial')}>
                <Progress
                    label={t('Participants who voted')}
                    value={7}
                    max={9}
                    valueLabel="7 / 9"
                    description={t('Waiting for the others')}
                />
            </State>
            <State label={t('Progress: 100 percent, success')}>
                <Progress
                    label={t('Participants who voted')}
                    value={9}
                    max={9}
                    valueLabel="9 / 9"
                    description={t('Everyone has voted')}
                />
            </State>
            <State label={t('Progress: success tone, actions done')}>
                <Progress
                    label={t('Actions done')}
                    value={3}
                    max={5}
                    valueLabel="3 / 5"
                    tone="success"
                />
            </State>
            <State
                label={t('Progress: indeterminate (still when reduced motion)')}
            >
                <Progress
                    label={t('Exporting to Jira')}
                    description={t('This can take a moment')}
                />
            </State>
        </section>
    );
}
