import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Timer } from '@/components/skrum/timer';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Interactive() {
    const [total, setTotal] = useState(65);
    const [remaining, setRemaining] = useState<number | null>(65);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused || remaining === null || remaining === 0) {
            return;
        }

        const id = window.setTimeout(
            () => setRemaining((value) => (value === null ? null : value - 1)),
            1000,
        );

        return () => window.clearTimeout(id);
    }, [paused, remaining]);

    return (
        <Timer
            remainingSeconds={remaining}
            totalSeconds={total}
            paused={paused}
            onStart={(seconds) => {
                setTotal(seconds);
                setRemaining(seconds);
                setPaused(false);
            }}
            onStop={() => setRemaining(null)}
            onPause={() => setPaused(true)}
            onResume={() => setPaused(false)}
            onAdd={(seconds) => {
                setTotal((value) => value + seconds);
                setRemaining((value) =>
                    value === null ? null : value + seconds,
                );
            }}
        />
    );
}

export default function TimerSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Normal')}>
                <Timer remainingSeconds={272} totalSeconds={360} />
            </Example>
            <Example label={t('Less than a minute (warning, no blinking)')}>
                <Timer remainingSeconds={48} totalSeconds={360} />
            </Example>
            <Example
                label={t(
                    'Done (nudge twice, then still; reduced motion: none)',
                )}
            >
                <Timer remainingSeconds={0} totalSeconds={360} />
            </Example>
            <Example label={t('Paused')}>
                <Timer remainingSeconds={130} totalSeconds={360} paused />
            </Example>
            <Example label={t('Large size, facilitator controls')}>
                <Timer
                    remainingSeconds={425}
                    totalSeconds={600}
                    size="lg"
                    onStart={noop}
                    onStop={noop}
                    onPause={noop}
                    onAdd={noop}
                />
            </Example>
            <Example label={t('Large size, less than a minute')}>
                <Timer remainingSeconds={32} totalSeconds={360} size="lg" />
            </Example>
            <Example label={t('Paused with resume')}>
                <Timer
                    remainingSeconds={130}
                    paused
                    onResume={noop}
                    onAdd={noop}
                />
            </Example>
            <Example label={t('No timer running, facilitator menu only')}>
                <Timer remainingSeconds={null} onStart={noop} onStop={noop} />
            </Example>
            <Example
                label={t(
                    'Poker durations (30 s, 1, 2, 3 min) with a custom entry',
                )}
            >
                <Timer
                    remainingSeconds={null}
                    onStart={noop}
                    onCustom={noop}
                    onStop={noop}
                    presets={[30, 60, 120, 180].map((seconds) => ({
                        seconds,
                    }))}
                />
            </Example>
            <Example label={t('Games durations (1, 2, 3, 5, 10 min)')}>
                <Timer
                    remainingSeconds={95}
                    totalSeconds={120}
                    onStart={noop}
                    onStop={noop}
                    presets={[1, 2, 3, 5, 10].map((minutes) => ({
                        seconds: minutes * 60,
                    }))}
                />
            </Example>
            <Example label={t('Over an hour')}>
                <Timer remainingSeconds={5025} totalSeconds={7200} />
            </Example>
            <Example label={t('Live (T pauses or resumes, + adds a minute)')}>
                <Interactive />
            </Example>
        </div>
    );
}
