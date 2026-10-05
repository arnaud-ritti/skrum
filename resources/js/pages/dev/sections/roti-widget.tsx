import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    ROTIHiddenDistribution,
    ROTIWidget,
} from '@/components/skrum/roti-widget';
import type { ROTIResult, Roti } from '@/components/skrum/roti-widget';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const result: ROTIResult = {
    mean: 3.8,
    votes: 11,
    distribution: { 1: 0, 2: 1, 3: 3, 4: 4, 5: 3 },
    previousMean: 3.4,
};

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

export default function ROTIWidgetSection() {
    const { t } = useTrans();
    const [interactive, setInteractive] = useState<Roti | null>(null);

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-6 p-4 md:p-6">
            <State
                label={t('Vote, nothing selected (focus then press 1 to 5)')}
            >
                <ROTIWidget
                    mode="vote"
                    value={interactive}
                    onVote={setInteractive}
                />
            </State>
            <State label={t('Vote, selected and sent')}>
                <ROTIWidget mode="vote" value={4} />
            </State>
            <State
                label={t(
                    'Vote, a row of five scores with an eyebrow and the hidden distribution',
                )}
            >
                <ROTIWidget
                    mode="vote"
                    layout="row"
                    value={4}
                    eyebrow={t('Last step · ROTI (return on time invested)')}
                    labels={{
                        saved: t(
                            'Vote saved · you can change it until the session ends',
                        ),
                    }}
                    footer={
                        <ROTIHiddenDistribution
                            title={t('Votes hidden until the end')}
                            note={t('Anonymous · nobody sees who voted what')}
                        />
                    }
                />
            </State>
            <State label={t('Result, 11 votes with trend')}>
                <ROTIWidget mode="result" result={result} />
            </State>
            <State
                label={t('Result, waiting for the last voters (facilitator)')}
            >
                <ROTIWidget
                    mode="result"
                    result={{
                        ...result,
                        missing: [{ name: 'Hana Gomez' }, { name: 'Guest' }],
                    }}
                    canClose
                    onClose={() => undefined}
                />
            </State>
            <State label={t('Result, one vote (shown by default)')}>
                <ROTIWidget
                    mode="result"
                    result={{
                        mean: 4,
                        votes: 1,
                        distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
                    }}
                />
            </State>
            <State label={t('Result, nobody has voted')}>
                <ROTIWidget
                    mode="result"
                    result={{
                        mean: null,
                        votes: 0,
                        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                    }}
                    canClose
                    onClose={() => undefined}
                />
            </State>
            <State label={t('Result, declining trend')}>
                <ROTIWidget
                    mode="result"
                    result={{ ...result, previousMean: 4.3 }}
                />
            </State>
        </div>
    );
}
