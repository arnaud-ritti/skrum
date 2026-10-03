import { useState } from 'react';
import RetroHealthCheckSubmissionsController from '@/actions/App/Http/Controllers/Retros/RetroHealthCheckSubmissionsController';
import { retroRequest } from '@/lib/retro/api';
import type { HealthProgress } from '@/lib/retro/types';
import { useBoard } from './board-context';

type Submission = HealthProgress & { hasSubmitted: boolean };

/**
 * The scores of the retro's health check, kept on this screen until "Submit
 * answers" sends them all at once: nothing reaches the server or the others
 * before. Once sent, they are final.
 */
export function useHealthCheckSubmission() {
    const ctx = useBoard();
    const healthCheck = ctx.board.healthCheck;
    const [chosen, setChosen] = useState<Record<string, number>>({});
    const [submitting, setSubmitting] = useState(false);

    const statements = healthCheck?.statements ?? [];
    const answers: Record<string, number> = {};

    for (const statement of statements) {
        const score = chosen[statement.key] ?? statement.myScore;

        if (score !== null && score !== undefined) {
            answers[statement.key] = score;
        }
    }

    const isOpen =
        healthCheck !== null &&
        !healthCheck.isClosed &&
        !healthCheck.hasSubmitted;
    const canSubmit =
        isOpen &&
        ctx.isEditable &&
        !submitting &&
        statements.length > 0 &&
        statements.every((statement) => answers[statement.key] !== undefined);

    const setAnswer = (key: string, score: number) => {
        if (!isOpen || !ctx.isEditable) {
            return;
        }

        setChosen((current) => ({ ...current, [key]: score }));
    };

    const submit = async (): Promise<void> => {
        if (!canSubmit) {
            return;
        }

        const scores = { ...answers };

        setSubmitting(true);

        const response = await ctx.run(
            retroRequest<Submission>(
                RetroHealthCheckSubmissionsController.store({
                    retro: ctx.board.retro.id,
                }),
                { scores },
            ),
        );

        setSubmitting(false);

        if (!response) {
            return;
        }

        ctx.apply({
            type: 'health.submitted',
            scores,
            respondents: response.respondents,
            participants: response.participants,
        });
    };

    return { answers, setAnswer, submit, submitting, canSubmit };
}
