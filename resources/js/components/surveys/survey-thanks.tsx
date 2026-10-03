import { CircleCheck } from 'lucide-react';
import { SurveyQuestion } from '@/components/skrum/survey-question';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { toQuestionProps } from '@/lib/surveys/question-adapter';
import type { SurveySnapshot } from '@/lib/surveys/types';

/**
 * The results a finished respondent may read, one card per question. The
 * results page's Summary takes this place once it exists.
 */
function SurveyAnswerResults({ snapshot }: { snapshot: SurveySnapshot }) {
    const { t } = useTrans();
    const { results, questions, survey } = snapshot;

    if (results === null) {
        return null;
    }

    if (results.belowThreshold) {
        return (
            <p className="text-center text-sm text-muted-foreground">
                {t('Results appear from :threshold answers. :count so far.', {
                    threshold: survey.resultsThreshold,
                    count: results.responses,
                })}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {questions.map((question, index) => (
                <SurveyQuestion
                    key={question.id}
                    {...toQuestionProps(question, {
                        mode: 'results',
                        index: index + 1,
                        count: questions.length,
                        summary: results.questions[question.id],
                        responses: results.responses,
                    })}
                />
            ))}
        </div>
    );
}

/** After "Finish": thanks, the count, a way back while open, then the results when allowed. */
export function SurveyThanks({
    snapshot,
    onChangeAnswers,
    busy = false,
}: {
    snapshot: SurveySnapshot;
    onChangeAnswers: () => void;
    busy?: boolean;
}) {
    const { t } = useTrans();
    const { survey, me, progress } = snapshot;
    const isOpen = survey.status === 'open';

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto flex w-full max-w-190 flex-col gap-6 px-4 py-10">
                <section className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center text-card-foreground shadow-card">
                    <CircleCheck
                        aria-hidden
                        className="size-8 text-skrum-success-text"
                    />
                    <h2 className="font-display text-xl font-semibold">
                        {t('Thank you — your answers are saved.')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {t(':count of :total have answered', {
                            count: progress.completed,
                            total: progress.audience,
                        })}
                    </p>
                    {isOpen && (
                        <Button
                            type="button"
                            variant="outline"
                            aria-busy={busy || undefined}
                            onClick={onChangeAnswers}
                        >
                            {t('Change my answers')}
                        </Button>
                    )}
                </section>
                {me.canSeeResults ? (
                    <SurveyAnswerResults snapshot={snapshot} />
                ) : (
                    isOpen && (
                        <p className="text-center text-sm text-muted-foreground">
                            {t('Results will show when the survey is closed')}
                        </p>
                    )
                )}
            </div>
        </div>
    );
}
