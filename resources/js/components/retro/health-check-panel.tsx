import { Check } from 'lucide-react';
import { useState } from 'react';
import HealthCheckAnswersController from '@/actions/App/Http/Controllers/Retros/HealthCheckAnswersController';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { HealthCheckStatement, HealthProgress } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';

const Scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const VisibleAvatars = 8;

export function HealthCheckPanel() {
    const { board } = useBoard();
    const { t } = useTrans();
    const statements = board.healthCheck?.statements ?? [];

    return (
        <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
            <header className="space-y-1">
                <h2 className="text-lg font-semibold">{t('Health check')}</h2>
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores.',
                    )}
                </p>
            </header>
            <ol className="space-y-3">
                {statements.map((statement) => (
                    <HealthStatementRow
                        key={statement.key}
                        statement={statement}
                    />
                ))}
            </ol>
        </section>
    );
}

function HealthStatementRow({
    statement,
}: {
    statement: HealthCheckStatement;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const retroId = ctx.board.retro.id;
    const disabled = busy || !ctx.isEditable;
    const respondents = statement.answeredBy
        .map((id) =>
            ctx.board.participants.find((participant) => participant.id === id),
        )
        .filter((participant) => participant !== undefined);

    const answer = async (score: number | null) => {
        if (busy) {
            return;
        }

        setBusy(true);
        ctx.dispatch({ type: 'health.answer', key: statement.key, score });

        const params = { retro: retroId, statement: statement.key };
        const route =
            score === null
                ? HealthCheckAnswersController.destroy(params)
                : HealthCheckAnswersController.update(params);

        const response = await ctx.run(
            retroRequest<{ statements: HealthProgress[] }>(
                route,
                score === null ? undefined : { score },
            ),
        );

        setBusy(false);

        if (response) {
            ctx.apply({
                type: 'health.progress',
                statements: response.statements,
            });
        }
    };

    return (
        <li className="space-y-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
                <p className="font-medium break-words">{statement.text}</p>
                {statement.myScore !== null && (
                    <Check
                        className="size-5 shrink-0 text-primary"
                        aria-label={t('Answered')}
                    />
                )}
            </div>

            <div
                role="radiogroup"
                aria-label={statement.text}
                className="grid grid-cols-5 gap-1 sm:grid-cols-10"
            >
                {Scores.map((score) => (
                    <Button
                        key={score}
                        type="button"
                        role="radio"
                        aria-checked={statement.myScore === score}
                        aria-label={t('Score :score', { score })}
                        variant={
                            statement.myScore === score ? 'default' : 'outline'
                        }
                        size="sm"
                        disabled={disabled}
                        onClick={() => void answer(score)}
                    >
                        {score}
                    </Button>
                ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('Awful')}</span>
                <span>{t('Great')}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex -space-x-2">
                        {respondents
                            .slice(0, VisibleAvatars)
                            .map((participant) => (
                                <Tooltip key={participant.id}>
                                    <TooltipTrigger asChild>
                                        <img
                                            src={participant.avatarUrl}
                                            alt={participant.name}
                                            className="size-6 rounded-full border-2 border-background bg-muted"
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {participant.name}
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                    </div>
                    <span className={cn(statement.count === 0 && 'opacity-70')}>
                        {t(':count answered', { count: statement.count })}
                    </span>
                </div>
                {statement.myScore !== null && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => void answer(null)}
                    >
                        {t('Clear')}
                    </Button>
                )}
            </div>
        </li>
    );
}
