import { useTrans } from '@/hooks/use-trans';
import { Phases, type RetroPhase } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export const PhaseLabels: Record<RetroPhase, string> = {
    writing: 'Writing',
    grouping: 'Grouping',
    voting: 'Voting',
    discussing: 'Discussing',
    completed: 'Completed',
};

export function PhaseStepper({ phase }: { phase: RetroPhase }) {
    const { t } = useTrans();
    const current = Phases.indexOf(phase);

    return (
        <ol
            className="flex items-center gap-1 text-xs"
            aria-label={t('Phases')}
        >
            {Phases.map((step, index) => (
                <li
                    key={step}
                    aria-current={step === phase ? 'step' : undefined}
                    className={cn(
                        'rounded-full px-2 py-0.5',
                        index < current && 'text-muted-foreground',
                        step === phase && 'bg-primary text-primary-foreground',
                    )}
                >
                    {t(PhaseLabels[step])}
                </li>
            ))}
        </ol>
    );
}
