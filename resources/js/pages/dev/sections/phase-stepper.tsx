import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { PhaseStepper } from '@/components/skrum/phase-stepper';
import type { PhaseStep } from '@/components/skrum/phase-stepper';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function usePhases(count: 6 | 7 | 8): PhaseStep[] {
    const { t } = useTrans();
    const all: PhaseStep[] = [
        { id: 'health_check', label: t('Health check') },
        { id: 'icebreaker', label: t('Icebreaker') },
        { id: 'writing', label: t('Writing') },
        { id: 'grouping', label: t('Grouping') },
        { id: 'voting', label: t('Voting') },
        { id: 'discussing', label: t('Discussing') },
        { id: 'actions', label: t('Actions') },
        { id: 'roti', label: t('ROTI') },
    ];

    if (count === 8) {
        return all;
    }

    if (count === 7) {
        return all.slice(1);
    }

    return all.slice(2);
}

function Live({ count }: { count: 6 | 7 | 8 }) {
    const { t } = useTrans();
    const phases = usePhases(count);
    const [current, setCurrent] = useState(phases[2].id);

    return (
        <PhaseStepper
            phases={phases}
            current={current}
            interactive
            leaderName={t('Camille')}
            onPhaseChange={setCurrent}
        />
    );
}

export default function PhaseStepperSection() {
    const { t } = useTrans();
    const six = usePhases(6);
    const seven = usePhases(7);
    const eight = usePhases(8);
    const skipped = seven.map((phase) =>
        phase.id === 'icebreaker' ? { ...phase, skipped: true } : phase,
    );
    const noop = (): void => {};
    const name = t('Camille');

    return (
        <div className="@container/session flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('6 phases, writing active (interactive)')}>
                <PhaseStepper
                    phases={six}
                    current="writing"
                    interactive
                    onPhaseChange={noop}
                />
            </Example>
            <Example label={t('7 phases, voting active (interactive)')}>
                <PhaseStepper
                    phases={seven}
                    current="voting"
                    interactive
                    onPhaseChange={noop}
                />
            </Example>
            <Example label={t('8 phases, discussing active (interactive)')}>
                <PhaseStepper
                    phases={eight}
                    current="discussing"
                    interactive
                    onPhaseChange={noop}
                />
            </Example>
            <Example label={t('Last phase: Complete')}>
                <PhaseStepper
                    phases={six}
                    current="roti"
                    interactive
                    onPhaseChange={noop}
                />
            </Example>
            <Example label={t('Participant, read only')}>
                <PhaseStepper
                    phases={seven}
                    current="voting"
                    leaderName={name}
                />
            </Example>
            <Example label={t('Compact, interactive')}>
                <PhaseStepper
                    phases={seven}
                    current="voting"
                    compact
                    interactive
                    onPhaseChange={noop}
                />
            </Example>
            <Example label={t('Compact, participant')}>
                <PhaseStepper
                    phases={eight}
                    current="grouping"
                    compact
                    leaderName={name}
                />
            </Example>
            <Example label={t('Skipped phase')}>
                <PhaseStepper
                    phases={skipped}
                    current="writing"
                    leaderName={name}
                />
            </Example>
            <Example label={t('Mobile, participant')}>
                <PhaseStepper
                    phases={seven}
                    current="voting"
                    mobile
                    leaderName={name}
                />
            </Example>
            <Example label={t('Mobile, interactive')}>
                <PhaseStepper
                    phases={eight}
                    current="grouping"
                    mobile
                    interactive
                    onPhaseChange={noop}
                />
            </Example>
            <Example label={t('Completed, interactive (Reopen)')}>
                <PhaseStepper
                    phases={seven}
                    current="completed"
                    interactive
                    onPhaseChange={noop}
                />
            </Example>
            <Example label={t('Completed, participant')}>
                <PhaseStepper phases={seven} current="completed" />
            </Example>
            <Example label={t('Completed, mobile')}>
                <PhaseStepper phases={seven} current="completed" mobile />
            </Example>
            <Example
                label={t(
                    'Follows its container: 20rem (Phase n/total and progress)',
                )}
            >
                <div className="w-80 max-w-full">
                    <PhaseStepper
                        phases={eight}
                        current="discussing"
                        interactive
                        onPhaseChange={noop}
                    />
                </div>
            </Example>
            <Example
                label={t(
                    'Follows its container: 40rem (markers, active label)',
                )}
            >
                <div className="w-160 max-w-full">
                    <PhaseStepper
                        phases={eight}
                        current="discussing"
                        interactive
                        onPhaseChange={noop}
                    />
                </div>
            </Example>
            <Example label={t('Follows its container: 20rem, participant')}>
                <div className="w-80 max-w-full">
                    <PhaseStepper
                        phases={seven}
                        current="voting"
                        leaderName={name}
                    />
                </div>
            </Example>
            <Example
                label={t(
                    'Live: Previous, Next, neighbour steps, arrow keys move focus',
                )}
            >
                <Live count={8} />
            </Example>
        </div>
    );
}
