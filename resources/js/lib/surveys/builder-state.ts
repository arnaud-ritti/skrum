import { useCallback, useEffect, useRef, useState } from 'react';
import type { SurveyKind, SurveyQuestionPayload } from './types';

export type QuestionBody = {
    kind: SurveyKind;
    label: string;
    description: string | null;
    is_required: boolean;
    allows_comment: boolean;
    scale_min_label?: string | null;
    scale_max_label?: string | null;
    options: string[];
};

export const MinOptions = 2;

export const MaxOptions = 10;

export const MaxQuestions = 30;

export function isChoiceKind(kind: SurveyKind): boolean {
    return kind === 'single' || kind === 'multiple';
}

function isNumericKind(kind: SurveyKind): boolean {
    return kind === 'scale' || kind === 'nps';
}

/** The body `surveys.questions.store|update` expects for a question as the builder holds it. */
export function questionBody(question: SurveyQuestionPayload): QuestionBody {
    return {
        kind: question.kind,
        label: question.label.trim(),
        description: question.description,
        is_required: question.isRequired,
        allows_comment: isNumericKind(question.kind) && question.allowsComment,
        ...(question.kind === 'scale'
            ? {
                  scale_min_label: question.scaleLabels?.[0] ?? null,
                  scale_max_label: question.scaleLabels?.[1] ?? null,
              }
            : {}),
        options: isChoiceKind(question.kind)
            ? question.options.map((option) => option.label)
            : [],
    };
}

/** What a question becomes when its kind changes: options appear for a choice, ends for a scale, and nothing else is carried over that the server would refuse. */
export function withKind(
    question: SurveyQuestionPayload,
    kind: SurveyKind,
    defaultOptions: [string, string],
): SurveyQuestionPayload {
    const keepsOptions = isChoiceKind(kind) && isChoiceKind(question.kind);
    const options = keepsOptions
        ? question.options
        : defaultOptions.map((label, index) => ({
              id: `new-${index}`,
              label,
          }));

    return {
        ...question,
        kind,
        scaleMax: kind === 'scale' ? 5 : null,
        scaleLabels:
            kind === 'scale' ? (question.scaleLabels ?? [null, null]) : null,
        allowsComment: isNumericKind(kind),
        options: isChoiceKind(kind) ? options : [],
    };
}

export type SaveState =
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'saved'; at: number }
    | { status: 'error'; message: string };

/** A choice question can be saved only with 2 to 10 non-empty options, a question only with a label. */
export function isSavable(question: SurveyQuestionPayload): boolean {
    if (question.label.trim() === '') {
        return false;
    }

    if (!isChoiceKind(question.kind)) {
        return true;
    }

    return (
        question.options.length >= MinOptions &&
        question.options.length <= MaxOptions &&
        question.options.every((option) => option.label.trim() !== '')
    );
}

type Run = () => Promise<unknown>;

type Pending = { run: Run; timer: ReturnType<typeof setTimeout> };

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Saves that wait for the typing to stop: one pending save per key (a
 * question id, or `survey`), the latest wins. `flush` runs every pending save
 * at once and resolves when all have answered, or rejects with the first
 * failure; `saveNow` runs one at once (a switch), `cancel` drops one (a
 * deleted question).
 */
export function useAutosave(delayMs = 600) {
    const [state, setState] = useState<SaveState>({ status: 'idle' });
    const pending = useRef(new Map<string, Pending>());
    const inFlight = useRef(0);
    const failure = useRef<string | null>(null);

    const start = useCallback(async (key: string): Promise<void> => {
        const entry = pending.current.get(key);

        if (entry === undefined) {
            return;
        }

        clearTimeout(entry.timer);
        pending.current.delete(key);
        inFlight.current++;
        setState({ status: 'saving' });

        try {
            await entry.run();
        } catch (error) {
            failure.current = messageOf(error);
            setState({ status: 'error', message: failure.current });

            throw error;
        } finally {
            inFlight.current--;
        }

        if (inFlight.current > 0 || pending.current.size > 0) {
            return;
        }

        if (failure.current !== null) {
            setState({ status: 'error', message: failure.current });

            return;
        }

        setState({ status: 'saved', at: Date.now() });
    }, []);

    const schedule = useCallback(
        (key: string, run: Run): void => {
            const known = pending.current.get(key);

            if (known !== undefined) {
                clearTimeout(known.timer);
            }

            failure.current = null;

            pending.current.set(key, {
                run,
                timer: setTimeout(() => {
                    start(key).catch(() => {});
                }, delayMs),
            });
        },
        [delayMs, start],
    );

    const flush = useCallback(async (): Promise<void> => {
        const results = await Promise.allSettled(
            [...pending.current.keys()].map((key) => start(key)),
        );
        const rejected = results.find(
            (result): result is PromiseRejectedResult =>
                result.status === 'rejected',
        );

        if (rejected !== undefined) {
            throw rejected.reason;
        }
    }, [start]);

    const cancel = useCallback((key: string): void => {
        const entry = pending.current.get(key);

        if (entry === undefined) {
            return;
        }

        clearTimeout(entry.timer);
        pending.current.delete(key);
    }, []);

    const saveNow = useCallback(
        (key: string, run: Run): Promise<void> => {
            schedule(key, run);

            return start(key);
        },
        [schedule, start],
    );

    const hasPending = useCallback(
        (): boolean => pending.current.size > 0 || inFlight.current > 0,
        [],
    );

    useEffect(() => {
        const entries = pending.current;

        return () => {
            for (const entry of entries.values()) {
                clearTimeout(entry.timer);
            }
        };
    }, []);

    return { schedule, saveNow, cancel, flush, hasPending, state };
}
