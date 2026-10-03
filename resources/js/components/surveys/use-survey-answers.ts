import { useCallback, useEffect, useRef, useState } from 'react';
import type { SurveyQuestionValue } from '@/components/skrum/survey-question';
import { answerOf, toQuestionProps } from '@/lib/surveys/question-adapter';
import type { SurveyQuestionPayload } from '@/lib/surveys/types';

/** Saves one answer: the value and comment on screen, or their withdrawal when empty. Rejects when it failed. */
export type SurveyAnswerSaver = (
    question: SurveyQuestionPayload,
    value: SurveyQuestionValue,
    comment: string,
) => Promise<void>;

type Draft = { value: SurveyQuestionValue; comment: string };

/** A multiple choice, a text and a comment wait this long after the last change. */
export const SaveDelayMs = 600;

function draftOf(question: SurveyQuestionPayload): Draft {
    const props = toQuestionProps(question, { mode: 'answer' });

    return { value: props.value ?? null, comment: props.comment ?? '' };
}

function savesAtOnce(question: SurveyQuestionPayload): boolean {
    return (
        question.kind === 'scale' ||
        question.kind === 'nps' ||
        question.kind === 'single'
    );
}

/**
 * The answers on screen, kept apart from the server's so that typing is never
 * overwritten, and their saving: at once for a pick, after a pause for what is
 * typed or ticked, and on demand (leaving a step, finishing). A failed save
 * keeps the value and is marked until it is retried. In preview nothing is sent.
 */
export function useSurveyAnswers(
    questions: SurveyQuestionPayload[],
    onSave: SurveyAnswerSaver,
    preview = false,
) {
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const latest = useRef<Record<string, Draft>>({});
    const byId = useRef(new Map<string, SurveyQuestionPayload>());
    const saver = useRef(onSave);

    saver.current = onSave;
    byId.current = new Map(
        questions.map((question) => [question.id, question]),
    );

    useEffect(() => {
        const pending = timers.current;

        return () => {
            pending.forEach((timer) => clearTimeout(timer));
            pending.clear();
        };
    }, []);

    const draft = useCallback(
        (question: SurveyQuestionPayload): Draft =>
            drafts[question.id] ?? draftOf(question),
        [drafts],
    );

    const save = useCallback(
        async (questionId: string): Promise<boolean> => {
            const question = byId.current.get(questionId);

            if (question === undefined || preview) {
                return true;
            }

            const current = latest.current[questionId] ?? draftOf(question);

            try {
                await saver.current(question, current.value, current.comment);
            } catch {
                setFailed((known) => new Set(known).add(questionId));

                return false;
            }

            setFailed((known) => {
                if (!known.has(questionId)) {
                    return known;
                }

                const next = new Set(known);

                next.delete(questionId);

                return next;
            });

            return true;
        },
        [preview],
    );

    const cancel = (questionId: string): boolean => {
        const timer = timers.current.get(questionId);

        if (timer === undefined) {
            return false;
        }

        clearTimeout(timer);
        timers.current.delete(questionId);

        return true;
    };

    const schedule = (questionId: string): void => {
        cancel(questionId);
        timers.current.set(
            questionId,
            setTimeout(() => {
                timers.current.delete(questionId);
                void save(questionId);
            }, SaveDelayMs),
        );
    };

    /** What is on screen now, including a change made in the same event. */
    const draftNow = (question: SurveyQuestionPayload): Draft =>
        latest.current[question.id] ?? draftOf(question);

    const write = (question: SurveyQuestionPayload, next: Draft): void => {
        latest.current = { ...latest.current, [question.id]: next };
        setDrafts((known) => ({ ...known, [question.id]: next }));
    };

    const change = (
        question: SurveyQuestionPayload,
        value: SurveyQuestionValue,
    ): void => {
        write(question, { ...draftNow(question), value });

        if (savesAtOnce(question)) {
            cancel(question.id);
            void save(question.id);

            return;
        }

        schedule(question.id);
    };

    const changeComment = (
        question: SurveyQuestionPayload,
        comment: string,
    ): void => {
        write(question, { ...draftNow(question), comment });
        schedule(question.id);
    };

    /** Sends at once what waits for the question, if anything. */
    const flush = async (questionId: string): Promise<boolean> => {
        if (!cancel(questionId)) {
            return true;
        }

        return save(questionId);
    };

    const flushAll = async (): Promise<boolean> => {
        const results = await Promise.all(
            [...timers.current.keys()].map((questionId) => flush(questionId)),
        );

        return results.every(Boolean);
    };

    const isAnswered = (question: SurveyQuestionPayload): boolean => {
        const current = draftNow(question);

        return answerOf(question, current.value, current.comment) !== null;
    };

    return {
        draft,
        change,
        changeComment,
        flush,
        flushAll,
        retry: save,
        isAnswered,
        hasFailed: (questionId: string) => failed.has(questionId),
    };
}

export type SurveyAnswers = ReturnType<typeof useSurveyAnswers>;
