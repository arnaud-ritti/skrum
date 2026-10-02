import { HeartPulse } from 'lucide-react';
import { useRef } from 'react';
import HealthCheckAnswersController from '@/actions/App/Http/Controllers/Retros/HealthCheckAnswersController';
import { HealthCheckForm } from '@/components/skrum/health-check-form';
import { useTrans } from '@/hooks/use-trans';
import { toHealthStatements } from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import type { HealthProgress } from '@/lib/retro/types';
import { useBoard } from './board-context';

/**
 * The health check of a retro: the line that says how to answer, and the
 * form. Each score is saved on its own; nothing is submitted at the end.
 */
export function PhaseHealth() {
    const ctx = useBoard();
    const { t } = useTrans();
    const retroId = ctx.board.retro.id;
    const sending = useRef(new Set<string>());
    const waiting = useRef(new Map<string, number | null>());

    const answer = async (key: string, score: number | null) => {
        if (!ctx.isEditable) {
            return;
        }

        ctx.dispatch({ type: 'health.answer', key, score });

        // One request per statement at a time: the arrow keys change a score
        // faster than the server answers, and the last one chosen must win.
        if (sending.current.has(key)) {
            waiting.current.set(key, score);

            return;
        }

        sending.current.add(key);

        let next: number | null | undefined = score;
        let response: { statements: HealthProgress[] } | undefined;

        while (next !== undefined) {
            const params = { retro: retroId, statement: key };

            response = await ctx.run(
                retroRequest<{ statements: HealthProgress[] }>(
                    next === null
                        ? HealthCheckAnswersController.destroy(params)
                        : HealthCheckAnswersController.update(params),
                    next === null ? undefined : { score: next },
                ),
            );

            next = response ? waiting.current.get(key) : undefined;
            waiting.current.delete(key);
        }

        sending.current.delete(key);

        if (response) {
            ctx.apply({
                type: 'health.progress',
                statements: response.statements,
            });
        }
    };

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
                        'Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores.',
                    )}
                </p>
            </div>
            <HealthCheckForm
                className="mx-auto w-full max-w-3xl"
                retroTitle={ctx.board.retro.title}
                statements={toHealthStatements(ctx.board)}
                disabled={!ctx.isEditable}
                onAnswer={(key, score) => void answer(key, score)}
                onClear={(key) => void answer(key, null)}
            />
        </section>
    );
}
