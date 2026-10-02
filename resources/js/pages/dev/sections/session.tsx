import { BenchSample, benchSidebar } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { SessionFrame } from '@/components/skrum/frames';
import { PhaseStepper } from '@/components/skrum/phase-stepper';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'layouts';

export default function SessionSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col">
            <SessionFrame
                sidebar={{ ...benchSidebar, active: 'sessions' }}
                title={t('Sprint :number retro', { number: 42 })}
                phases={
                    <PhaseStepper
                        phases={[
                            { id: 'writing', label: t('Writing') },
                            { id: 'grouping', label: t('Grouping') },
                            { id: 'voting', label: t('Voting') },
                            { id: 'discussing', label: t('Discussing') },
                            { id: 'actions', label: t('Actions') },
                            { id: 'roti', label: t('ROTI') },
                        ]}
                        current="voting"
                    />
                }
            >
                <div className="p-6">
                    <BenchSample label={t('SessionLayout, signed-in member')} />
                </div>
            </SessionFrame>
            <SessionFrame title={t('Sprint :number retro', { number: 42 })}>
                <div className="p-6">
                    <BenchSample
                        label={t('SessionLayout, guest: no sidebar')}
                    />
                </div>
            </SessionFrame>
        </div>
    );
}
