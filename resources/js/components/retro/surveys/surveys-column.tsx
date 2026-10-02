import { ListChecks } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { SurveyPhases } from '@/lib/retro/survey-api';
import { cn } from '@/lib/utils';
import { useBoard } from '../board-context';
import { SurveyBoardCard } from './survey-board-card';

/**
 * The surveys of the retro, beside the columns of the board. It takes the
 * width of its container; the columns scroller gives it the width of a
 * column.
 */
export function SurveysColumn({ className }: { className?: string }) {
    const { board } = useBoard();
    const { t } = useTrans();

    if (
        !SurveyPhases.includes(board.retro.phase) ||
        board.surveys.length === 0
    ) {
        return null;
    }

    return (
        <section
            aria-label={t('Surveys')}
            data-slot="retro-surveys"
            className={cn(
                'flex max-w-full min-w-0 flex-col gap-3 rounded-xl border border-border bg-muted/40 p-3',
                className,
            )}
        >
            <header className="flex min-h-8 min-w-0 items-center gap-2 px-0.5">
                <ListChecks
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                />
                <h2 className="min-w-0 flex-1 truncate text-sm/snug font-semibold text-foreground">
                    {t('Surveys')}
                </h2>
                <span
                    aria-hidden
                    className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums"
                >
                    {board.surveys.length}
                </span>
            </header>
            {board.surveys.map((survey) => (
                <SurveyBoardCard key={survey.id} survey={survey} />
            ))}
        </section>
    );
}
