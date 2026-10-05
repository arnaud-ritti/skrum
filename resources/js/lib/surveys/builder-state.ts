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

type Flight = { key: string; done: Promise<void> };

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Saves that wait for the typing to stop: one pending save per key (a
 * question id, or `survey`), the latest wins, sent once the save in flight of
 * its key has answered so an older body never lands last. A failed key stays in error until
 * it saves again or is cancelled. `flush` runs every pending save at once and
 * resolves when every save, in flight included, has answered, or rejects with
 * the first failure; `saveNow` runs one at once (a switch), `cancel` drops one
 * and waits for its save in flight (a deleted question). Leaving the page
 * sends the pending saves instead of dropping them.
 */
export function useAutosave(delayMs = 600) {
    const [state, setState] = useState<SaveState>({ status: 'idle' });
    const pending = useRef(new Map<string, Pending>());
    const inFlight = useRef(new Set<Flight>());
    const failures = useRef(new Map<string, string>());

    const settle = useCallback((): void => {
        if (inFlight.current.size > 0 || pending.current.size > 0) {
            return;
        }

        const [failure] = failures.current.values();

        if (failure !== undefined) {
            setState({ status: 'error', message: failure });

            return;
        }

        setState({ status: 'saved', at: Date.now() });
    }, []);

    const start = useCallback(
        (key: string): Promise<void> => {
            const entry = pending.current.get(key);

            if (entry === undefined) {
                return Promise.resolve();
            }

            clearTimeout(entry.timer);
            pending.current.delete(key);
            setState({ status: 'saving' });

            const previous = [...inFlight.current].findLast(
                (known) => known.key === key,
            );
            const flight: Flight = { key, done: Promise.resolve() };

            inFlight.current.add(flight);
            flight.done = (async () => {
                try {
                    if (previous !== undefined) {
                        await previous.done.catch(() => {});
                    }

                    await entry.run();
                    failures.current.delete(key);
                } catch (error) {
                    failures.current.set(key, messageOf(error));

                    throw error;
                } finally {
                    inFlight.current.delete(flight);
                    settle();
                }
            })();

            return flight.done;
        },
        [settle],
    );

    const schedule = useCallback(
        (key: string, run: Run): void => {
            const known = pending.current.get(key);

            if (known !== undefined) {
                clearTimeout(known.timer);
            }

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
        for (const key of pending.current.keys()) {
            start(key).catch(() => {});
        }

        const results = await Promise.allSettled(
            [...inFlight.current].map((flight) => flight.done),
        );
        const rejected = results.find(
            (result): result is PromiseRejectedResult =>
                result.status === 'rejected',
        );

        if (rejected !== undefined) {
            throw rejected.reason;
        }

        const [failure] = failures.current.values();

        if (failure !== undefined) {
            throw new Error(failure);
        }
    }, [start]);

    const cancel = useCallback(
        async (key: string): Promise<void> => {
            const entry = pending.current.get(key);

            if (entry !== undefined) {
                clearTimeout(entry.timer);
                pending.current.delete(key);
            }

            if (failures.current.delete(key)) {
                settle();
            }

            await Promise.allSettled(
                [...inFlight.current]
                    .filter((flight) => flight.key === key)
                    .map((flight) => flight.done),
            );
        },
        [settle],
    );

    const saveNow = useCallback(
        (key: string, run: Run): Promise<void> => {
            schedule(key, run);

            return start(key);
        },
        [schedule, start],
    );

    const hasPending = useCallback(
        (): boolean => pending.current.size > 0 || inFlight.current.size > 0,
        [],
    );

    const hasFailed = useCallback((): boolean => failures.current.size > 0, []);

    useEffect(() => {
        const entries = pending.current;

        return () => {
            for (const key of entries.keys()) {
                start(key).catch(() => {});
            }
        };
    }, [start]);

    return { schedule, saveNow, cancel, flush, hasPending, hasFailed, state };
}
