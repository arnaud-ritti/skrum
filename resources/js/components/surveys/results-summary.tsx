import { EyeOff } from 'lucide-react';
import { useId } from 'react';
import { SurveyQuestion } from '@/components/skrum/survey-question';
import type { SurveyQuestionDelta } from '@/components/skrum/survey-question';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { toQuestionProps } from '@/lib/surveys/question-adapter';
import type {
    SurveyQuestionPayload,
    SurveyQuestionSummary,
    SurveySnapshot,
} from '@/lib/surveys/types';
import { cn } from '@/lib/utils';

export type ResultsSummaryProps = {
    snapshot: SurveySnapshot;
    /** The difference of a figure with another survey, by question id. */
    deltas?: Record<string, SurveyQuestionDelta>;
    /** "See the n answers" of a text card: the free-text tab, at that question. */
    onShowFreeText?: (questionId: string) => void;
};

const TextCardAnswers = 6;

/** The eight column tones, in the mockup's order, one per answer in rotation. */
const AnswerTones = [
    'border-skrum-col-moss-border bg-skrum-col-moss',
    'border-skrum-col-sky-border bg-skrum-col-sky',
    'border-skrum-col-sun-border bg-skrum-col-sun',
    'border-skrum-col-apricot-border bg-skrum-col-apricot',
    'border-skrum-col-lagoon-border bg-skrum-col-lagoon',
    'border-skrum-col-plum-border bg-skrum-col-plum',
    'border-skrum-col-coral-border bg-skrum-col-coral',
    'border-skrum-col-iris-border bg-skrum-col-iris',
];

function NoAnswers() {
    const { t } = useTrans();

    return (
        <p
            data-slot="survey-results-none"
            className="text-xs text-muted-foreground"
        >
            {t('No answers yet.')}
        </p>
    );
}

function TextCard({
    question,
    index,
    count,
    summary,
    onShowFreeText,
}: {
    question: SurveyQuestionPayload;
    index: number;
    count: number;
    summary: SurveyQuestionSummary | undefined;
    onShowFreeText?: (questionId: string) => void;
}) {
    const { t } = useTrans();
    const labelId = useId();
    const answers = summary?.answers ?? [];
    const responses = summary?.responses ?? 0;

    return (
        <article
            data-slot="survey-question"
            data-kind="text"
            data-mode="results"
            aria-labelledby={labelId}
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-card @3xl:col-span-2"
        >
            <header className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                        {t(':index / :count', { index, count })}
                    </span>
                    <Badge variant="muted">
                        <span className="truncate">{t('Free text')}</span>
                    </Badge>
                    <Badge variant="outline">
                        <EyeOff />
                        <span className="truncate">{t('Anonymous')}</span>
                    </Badge>
                    <span
                        data-slot="survey-response-count"
                        className="tabular-nums"
                    >
                        {responses === 1
                            ? t('1 response')
                            : t(':count responses', { count: responses })}
                    </span>
                </div>
                <h3
                    id={labelId}
                    className="font-display text-base font-semibold break-words"
                >
                    {question.label}
                </h3>
            </header>
            {answers.length === 0 ? (
                <NoAnswers />
            ) : (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(52)),1fr))] gap-3">
                    {answers
                        .slice(0, TextCardAnswers)
                        .map((answer, position) => (
                            <li
                                key={answer.id}
                                className={cn(
                                    'min-w-0 rounded-md border px-3 py-2.5 text-sm break-words whitespace-pre-wrap text-foreground',
                                    AnswerTones[position % AnswerTones.length],
                                )}
                            >
                                {answer.text}
                                {answer.isMine && (
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        {t('Your answer')}
                                    </span>
                                )}
                            </li>
                        ))}
                </ul>
            )}
            {answers.length > TextCardAnswers && (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto self-start p-0"
                    onClick={() => onShowFreeText?.(question.id)}
                >
                    <span className="truncate">
                        {t('See the :count answers', {
                            count: answers.length,
                        })}
                    </span>
                </Button>
            )}
        </article>
    );
}

/** One card per question, as the server summarised it for this viewer. */
export function ResultsSummary({
    snapshot,
    deltas,
    onShowFreeText,
}: ResultsSummaryProps) {
    const summaries = snapshot.results?.questions ?? {};
    const count = snapshot.questions.length;

    return (
        <div className="@container">
            <div
                data-slot="survey-results-grid"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(88)),1fr))] gap-4"
            >
                {snapshot.questions.map((question, position) => {
                    const summary = summaries[question.id];

                    if (question.kind === 'text') {
                        return (
                            <TextCard
                                key={question.id}
                                question={question}
                                index={position + 1}
                                count={count}
                                summary={summary}
                                onShowFreeText={onShowFreeText}
                            />
                        );
                    }

                    const props = toQuestionProps(question, {
                        mode: 'results',
                        index: position + 1,
                        count,
                        summary,
                        responses: summary?.responses ?? 0,
                    });
                    const delta = deltas?.[question.id];

                    return (
                        <SurveyQuestion
                            key={question.id}
                            {...props}
                            scaleChart="histogram"
                            aria-label={question.label}
                            results={
                                props.results && delta
                                    ? { ...props.results, delta }
                                    : props.results
                            }
                            footer={
                                summary !== undefined &&
                                summary.responses === 0 ? (
                                    <NoAnswers />
                                ) : undefined
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
}
