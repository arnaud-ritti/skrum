import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { MaxSurveys, SurveyPhases } from '@/lib/retro/survey-api';
import { useBoard } from './board-context';
import { SurveyCard } from './survey-card';
import { SurveyDialog } from './survey-dialog';

export function SurveysColumn() {
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
            className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-t-4 border-t-primary bg-muted/30 p-3"
        >
            <h2 className="text-sm font-semibold">{t('Surveys')}</h2>
            {board.surveys.map((survey) => (
                <SurveyCard key={survey.id} survey={survey} />
            ))}
        </section>
    );
}

export function AddSurveyButton() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const { board } = ctx;

    if (
        !board.viewer.isFacilitator ||
        !SurveyPhases.includes(board.retro.phase) ||
        !ctx.isEditable ||
        board.surveys.length >= MaxSurveys
    ) {
        return null;
    }

    return (
        <>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                <ListChecks className="size-4" />
                {t('Add survey')}
            </Button>
            <SurveyDialog
                open={open && !ctx.sessionExpired}
                onOpenChange={setOpen}
            />
        </>
    );
}
