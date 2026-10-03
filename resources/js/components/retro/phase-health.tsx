import { HeartPulse } from 'lucide-react';
import { HealthCheckForm } from '@/components/skrum/health-check-form';
import { useTrans } from '@/hooks/use-trans';
import { toHealthStatements } from '@/lib/retro/adapters';
import { useBoard } from './board-context';
import { useHealthCheckSubmission } from './use-health-check-submission';

/**
 * The health check of a retro: the line that says how to answer, and the
 * form. Every statement is scored, then sent at once with "Submit answers".
 */
export function PhaseHealth() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { answers, setAnswer, submit } = useHealthCheckSubmission();
    const healthCheck = ctx.board.healthCheck;
    const scale = healthCheck?.scale ?? 5;

    return (
        <section
            data-slot="retro-health"
            aria-label={t('Health check')}
            className="flex shrink-0 flex-col gap-3 px-4 pt-3 md:px-6"
        >
            <div
                data-slot="retro-health-banner"
                className="flex items-start gap-3 text-body-sm text-muted-foreground"
            >
                <HeartPulse className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1">
                    {t(
                        'Rate each statement from 1 (Strongly disagree) to :max (Strongly agree). Only you see your own scores.',
                        { max: scale },
                    )}
                </p>
            </div>
            <HealthCheckForm
                className="mx-auto w-full max-w-3xl"
                retroTitle={ctx.board.retro.title}
                statements={toHealthStatements(ctx.board)}
                scale={scale}
                answers={answers}
                disabled={!ctx.isEditable || (healthCheck?.isClosed ?? true)}
                submitted={healthCheck?.hasSubmitted ?? false}
                onAnswer={setAnswer}
                onSubmit={() => void submit()}
            />
        </section>
    );
}
