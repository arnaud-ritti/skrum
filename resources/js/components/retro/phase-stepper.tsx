import { useState } from 'react';
import RetroPhasesController from '@/actions/App/Http/Controllers/Retros/RetroPhasesController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { Phases, type RetroPhase } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';

export const PhaseLabels: Record<RetroPhase, string> = {
    writing: 'Writing',
    grouping: 'Grouping',
    voting: 'Voting',
    discussing: 'Discussing',
    completed: 'Completed',
};

type Props = {
    phase: RetroPhase;
    onChanged?: () => void;
};

export function PhaseStepper({ phase, onChanged }: Props) {
    const { t } = useTrans();
    const ctx = useBoard();
    const [busy, setBusy] = useState(false);
    const current = Phases.indexOf(phase);
    const previous = Phases[current - 1];
    const next = Phases[current + 1];

    const move = async (target: RetroPhase) => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<{ phase: RetroPhase }>(
                RetroPhasesController.update(ctx.board.retro.id),
                { phase: target },
            ),
        );

        setBusy(false);

        if (response) {
            onChanged?.();
        }
    };

    const isFacilitator = ctx.board.viewer.isFacilitator;

    return (
        <div className="flex items-center gap-2">
            {isFacilitator && previous && phase !== 'completed' && (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void move(previous)}
                >
                    {t('Previous')}
                </Button>
            )}
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
                            step === phase &&
                                'bg-primary text-primary-foreground',
                        )}
                    >
                        {t(PhaseLabels[step])}
                    </li>
                ))}
            </ol>
            {isFacilitator && next && (
                <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void move(next)}
                >
                    {t(next === 'completed' ? 'Complete' : 'Next')}
                </Button>
            )}
            {isFacilitator && phase === 'completed' && (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void move('discussing')}
                >
                    {t('Reopen')}
                </Button>
            )}
        </div>
    );
}
