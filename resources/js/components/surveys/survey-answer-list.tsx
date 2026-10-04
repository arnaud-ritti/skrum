import { useRef, useState } from 'react';
import { SurveyQuestion } from '@/components/skrum/survey-question';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError } from '@/lib/retro/api';
import { missingRequired } from '@/lib/surveys/answer-flow';
import { toQuestionProps } from '@/lib/surveys/question-adapter';
import type { SurveyQuestionPayload } from '@/lib/surveys/types';
import {
    SurveyNotSaved,
    SurveyPrivacyLine,
    focusControl,
    submissionError,
} from './survey-answer-flow';
import { useSurveyAnswers } from './use-survey-answers';
import type { SurveyAnswerSaver } from './use-survey-answers';

type SurveyAnswerListProps = {
    questions: SurveyQuestionPayload[];
    onSave: SurveyAnswerSaver;
    onFinish: () => Promise<void> | void;
    /** An observer of the team: the questions are shown, nothing is answered nor sent. */
    readOnly?: boolean;
};

function namedQuestions(
    error: unknown,
    questions: SurveyQuestionPayload[],
): string[] {
    if (!(error instanceof RetroRequestError) || error.status !== 422) {
        return [];
    }

    return questions
        .filter((question) => `questions.${question.id}` in error.errors)
        .map((question) => question.id);
}

/** Every question on one page, when the survey does not ask one at a time. */
export function SurveyAnswerList({
    questions,
    onSave,
    onFinish,
    readOnly = false,
}: SurveyAnswerListProps) {
    const { t } = useTrans();
    const answers = useSurveyAnswers(questions, onSave);
    const [invalidIds, setInvalidIds] = useState<string[]>([]);
    const [finishError, setFinishError] = useState<string | null>(null);
    const [finishing, setFinishing] = useState(false);
    const cards = useRef(new Map<string, HTMLDivElement>());

    const showFirst = (ids: string[]): void => {
        setInvalidIds(ids);

        const first = cards.current.get(ids[0]);

        first?.scrollIntoView({ block: 'center' });
        focusControl(first ?? null);
    };

    const finish = async (): Promise<void> => {
        if (finishing) {
            return;
        }

        const missing = missingRequired(questions, answers.isAnswered);

        if (missing.length > 0) {
            showFirst(missing);

            return;
        }

        setInvalidIds([]);
        setFinishError(null);
        setFinishing(true);

        try {
            const unsaved = await answers.flushAll();

            if (unsaved.length > 0) {
                cards.current
                    .get(unsaved[0])
                    ?.scrollIntoView({ block: 'center' });
                setFinishError(t('Your answers could not be sent. Try again.'));

                return;
            }

            await onFinish();
        } catch (error) {
            const named = namedQuestions(error, questions);

            if (named.length > 0) {
                showFirst(named);

                return;
            }

            setFinishError(
                submissionError(error) ??
                    t('Your answers could not be sent. Try again.'),
            );
        } finally {
            setFinishing(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto flex w-full max-w-190 flex-col gap-4 px-4 py-6 md:py-10">
                {questions.map((question, index) => {
                    const draft = answers.draft(question);
                    const takesComment =
                        question.allowsComment &&
                        (question.kind === 'scale' || question.kind === 'nps');

                    return (
                        <div
                            key={question.id}
                            ref={(element) => {
                                if (element === null) {
                                    cards.current.delete(question.id);

                                    return;
                                }

                                cards.current.set(question.id, element);
                            }}
                            className="flex flex-col gap-1"
                        >
                            <SurveyQuestion
                                {...toQuestionProps(question, {
                                    mode: 'answer',
                                    index: index + 1,
                                    count: questions.length,
                                })}
                                invalid={
                                    invalidIds.includes(question.id) &&
                                    !answers.isAnswered(question)
                                }
                                disabled={readOnly}
                                value={draft.value}
                                comment={draft.comment}
                                onChange={(value) =>
                                    answers.change(question, value)
                                }
                                onCommentChange={
                                    takesComment
                                        ? (comment) =>
                                              answers.changeComment(
                                                  question,
                                                  comment,
                                              )
                                        : undefined
                                }
                            />
                            {answers.hasFailed(question.id) && (
                                <SurveyNotSaved
                                    onRetry={() =>
                                        void answers.retry(question.id)
                                    }
                                />
                            )}
                        </div>
                    );
                })}
                {finishError && (
                    <p
                        role="alert"
                        className="text-sm text-skrum-destructive-text"
                    >
                        {finishError}
                    </p>
                )}
                {!readOnly && (
                    <Button
                        type="button"
                        size="lg"
                        aria-busy={finishing || undefined}
                        onClick={() => void finish()}
                        className="self-end"
                    >
                        {t('Finish')}
                    </Button>
                )}
                <SurveyPrivacyLine />
            </div>
        </div>
    );
}
