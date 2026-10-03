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
 * typed or ticked, and on demand (leaving a step, finishing). The saves of one
 * question run one after the other, so each sends what is on screen when it
 * starts and a withdrawal never overtakes the save it undoes. A failed save
 * keeps the value and is marked until it is retried. In preview nothing is sent.
 */
export function useSurveyAnswers(
    questions: SurveyQuestionPayload[],
    onSave: SurveyAnswerSaver,
    preview = false,
) {
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
    const failedNow = useRef<ReadonlySet<string>>(new Set());
    const inFlight = useRef(new Map<string, Promise<boolean>>());
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

    const markFailed = useCallback(
        (questionId: string, hasFailed: boolean): void => {
            if (failedNow.current.has(questionId) === hasFailed) {
                return;
            }

            const next = new Set(failedNow.current);

            if (hasFailed) {
                next.add(questionId);
            } else {
                next.delete(questionId);
            }

            failedNow.current = next;
            setFailed(next);
        },
        [],
    );

    const send = useCallback(
        async (questionId: string): Promise<boolean> => {
            const question = byId.current.get(questionId);

            if (question === undefined) {
                return true;
            }

            const current = latest.current[questionId] ?? draftOf(question);

            try {
                await saver.current(question, current.value, current.comment);
            } catch {
                markFailed(questionId, true);

                return false;
            }

            markFailed(questionId, false);

            return true;
        },
        [markFailed],
    );

    const save = useCallback(
        (questionId: string): Promise<boolean> => {
            if (preview) {
                return Promise.resolve(true);
            }

            const previous = inFlight.current.get(questionId);
            const run = (previous ?? Promise.resolve(true)).then(() =>
                send(questionId),
            );

            inFlight.current.set(questionId, run);
            void run.finally(() => {
                if (inFlight.current.get(questionId) === run) {
                    inFlight.current.delete(questionId);
                }
            });

            return run;
        },
        [preview, send],
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

    /**
     * Sends what waits, retries what failed and waits for what is on its way,
     * for every question. Resolves with the ids still not saved.
     */
    const flushAll = async (): Promise<string[]> => {
        const questionIds = new Set([
            ...timers.current.keys(),
            ...failedNow.current,
            ...inFlight.current.keys(),
        ]);
        const results = await Promise.all(
            [...questionIds].map(async (questionId) => {
                const mustSend =
                    cancel(questionId) || failedNow.current.has(questionId);
                const saved = mustSend
                    ? await save(questionId)
                    : await (inFlight.current.get(questionId) ?? true);

                return saved ? null : questionId;
            }),
        );

        return results.filter((questionId) => questionId !== null);
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
