import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isSavable,
    questionBody,
    useAutosave,
    withKind,
} from './builder-state';
import type { SurveyQuestionPayload } from './types';

function question(
    overrides: Partial<SurveyQuestionPayload> = {},
): SurveyQuestionPayload {
    return {
        id: 'q-1',
        kind: 'text',
        label: 'A word for the team?',
        shortLabel: null,
        description: null,
        position: 0,
        isRequired: false,
        allowsComment: false,
        scaleMax: null,
        scaleLabels: null,
        isBuiltin: false,
        options: [],
        myAnswer: null,
        ...overrides,
    };
}

const choice = question({
    kind: 'single',
    label: 'Which ritual?',
    options: [
        { id: 'o-1', label: 'Daily' },
        { id: 'o-2', label: 'Review' },
    ],
});

describe('questionBody', () => {
    it('sends the ends of a scale and no options', () => {
        expect(
            questionBody(
                question({
                    kind: 'scale',
                    label: '  Workload?  ',
                    isRequired: true,
                    allowsComment: true,
                    scaleMax: 5,
                    scaleLabels: ['Unbearable', null],
                }),
            ),
        ).toEqual({
            kind: 'scale',
            label: 'Workload?',
            description: null,
            is_required: true,
            allows_comment: true,
            scale_min_label: 'Unbearable',
            scale_max_label: null,
            options: [],
        });
    });

    it('sends no ends outside a scale', () => {
        const body = questionBody(
            question({ kind: 'nps', allowsComment: true }),
        );

        expect(body).not.toHaveProperty('scale_min_label');
        expect(body).not.toHaveProperty('scale_max_label');
        expect(body.allows_comment).toBe(true);
        expect(body.options).toEqual([]);
    });

    it('sends the option labels of a choice', () => {
        expect(questionBody(choice).options).toEqual(['Daily', 'Review']);
        expect(questionBody({ ...choice, kind: 'multiple' }).options).toEqual([
            'Daily',
            'Review',
        ]);
    });

    it('never sends a comment on a text, even when the payload says so', () => {
        const body = questionBody(question({ allowsComment: true }));

        expect(body.allows_comment).toBe(false);
        expect(body.options).toEqual([]);
        expect(body).not.toHaveProperty('scale_min_label');
    });

    it('never sends a comment on a choice', () => {
        expect(
            questionBody({ ...choice, allowsComment: true }).allows_comment,
        ).toBe(false);
    });
});

describe('withKind', () => {
    it('gives a text turned into a single choice the two default options', () => {
        const changed = withKind(question(), 'single', [
            'Option 1',
            'Option 2',
        ]);

        expect(changed.kind).toBe('single');
        expect(changed.options.map((option) => option.label)).toEqual([
            'Option 1',
            'Option 2',
        ]);
        expect(changed.scaleMax).toBeNull();
        expect(changed.allowsComment).toBe(false);
    });

    it('keeps the options from a single to a multiple choice', () => {
        const changed = withKind(choice, 'multiple', ['Option 1', 'Option 2']);

        expect(changed.options).toEqual(choice.options);
    });

    it('gives a scale its ends and drops the options', () => {
        const changed = withKind(choice, 'scale', ['Option 1', 'Option 2']);

        expect(changed.scaleMax).toBe(5);
        expect(changed.scaleLabels).toEqual([null, null]);
        expect(changed.options).toEqual([]);
        expect(changed.allowsComment).toBe(true);
    });
});

describe('isSavable', () => {
    it('refuses an empty label', () => {
        expect(isSavable(question({ label: '   ' }))).toBe(false);
    });

    it('accepts a text with a label', () => {
        expect(isSavable(question())).toBe(true);
    });

    it('refuses a choice with one option', () => {
        expect(
            isSavable({ ...choice, options: [{ id: 'o-1', label: 'Daily' }] }),
        ).toBe(false);
    });

    it('refuses a choice with eleven options', () => {
        expect(
            isSavable({
                ...choice,
                options: Array.from({ length: 11 }, (_, index) => ({
                    id: `o-${index}`,
                    label: `Option ${index}`,
                })),
            }),
        ).toBe(false);
    });

    it('refuses a blank option', () => {
        expect(
            isSavable({
                ...choice,
                options: [...choice.options, { id: 'o-3', label: ' ' }],
            }),
        ).toBe(false);
    });

    it('accepts a choice with two to ten filled options', () => {
        expect(isSavable(choice)).toBe(true);
    });
});

describe('useAutosave', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('makes one request for two edits of one question within the delay', async () => {
        const first = vi.fn(() => Promise.resolve());
        const second = vi.fn(() => Promise.resolve());
        const { result } = renderHook(() => useAutosave(600));

        act(() => result.current.schedule('q-1', first));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        act(() => result.current.schedule('q-1', second));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        expect(result.current.state.status).toBe('saved');
    });

    it('makes two requests for edits of two questions', async () => {
        const first = vi.fn(() => Promise.resolve());
        const second = vi.fn(() => Promise.resolve());
        const { result } = renderHook(() => useAutosave(600));

        act(() => {
            result.current.schedule('q-1', first);
            result.current.schedule('q-2', second);
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('shows saving while a request runs', async () => {
        let resolve: () => void = () => {};
        const run = vi.fn(
            () =>
                new Promise<void>((done) => {
                    resolve = done;
                }),
        );
        const { result } = renderHook(() => useAutosave(600));

        act(() => result.current.schedule('q-1', run));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(result.current.state.status).toBe('saving');

        await act(async () => {
            resolve();
        });

        expect(result.current.state.status).toBe('saved');
    });

    it('sets an error on a rejected save and keeps the others', async () => {
        const failing = vi.fn(() => Promise.reject(new Error('Nope')));
        const other = vi.fn(() => Promise.resolve());
        const { result } = renderHook(() => useAutosave(600));

        act(() => {
            result.current.schedule('q-1', failing);
            result.current.schedule('q-2', other);
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(other).toHaveBeenCalledTimes(1);
        expect(result.current.state).toEqual({
            status: 'error',
            message: 'Nope',
        });
    });

    it('flushes every pending save at once', async () => {
        const first = vi.fn(() => Promise.resolve());
        const second = vi.fn(() => Promise.resolve());
        const { result } = renderHook(() => useAutosave(600));

        act(() => {
            result.current.schedule('q-1', first);
            result.current.schedule('survey', second);
        });
        await act(async () => {
            await result.current.flush();
        });

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(result.current.hasPending()).toBe(false);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(first).toHaveBeenCalledTimes(1);
    });

    it('rejects a flush when a save fails', async () => {
        const { result } = renderHook(() => useAutosave(600));

        act(() =>
            result.current.schedule('q-1', () =>
                Promise.reject(new Error('Nope')),
            ),
        );

        await act(async () => {
            await expect(result.current.flush()).rejects.toThrow('Nope');
        });
    });

    it('cancels the pending save of a key', async () => {
        const run = vi.fn(() => Promise.resolve());
        const { result } = renderHook(() => useAutosave(600));

        act(() => result.current.schedule('q-1', run));
        await act(async () => {
            await result.current.cancel('q-1');
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(run).not.toHaveBeenCalled();
        expect(result.current.hasPending()).toBe(false);
    });

    it('saves a key now, replacing its pending save', async () => {
        const pending = vi.fn(() => Promise.resolve());
        const now = vi.fn(() => Promise.resolve());
        const { result } = renderHook(() => useAutosave(600));

        act(() => result.current.schedule('settings', pending));
        await act(async () => {
            await result.current.saveNow('settings', now);
        });

        expect(now).toHaveBeenCalledTimes(1);
        expect(pending).not.toHaveBeenCalled();
        expect(result.current.state.status).toBe('saved');
    });

    it('stays in error while a failed key is unsaved, even after another key saves', async () => {
        const { result } = renderHook(() => useAutosave(600));

        act(() =>
            result.current.schedule('q-1', () =>
                Promise.reject(new Error('Nope')),
            ),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        act(() => result.current.schedule('q-2', () => Promise.resolve()));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(result.current.state).toEqual({
            status: 'error',
            message: 'Nope',
        });
        expect(result.current.hasFailed()).toBe(true);
    });

    it('leaves the error once the failed key saves again', async () => {
        const { result } = renderHook(() => useAutosave(600));

        act(() =>
            result.current.schedule('q-1', () =>
                Promise.reject(new Error('Nope')),
            ),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        act(() => result.current.schedule('q-1', () => Promise.resolve()));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(result.current.state.status).toBe('saved');
        expect(result.current.hasFailed()).toBe(false);
    });

    it('waits in a flush for a save already in flight', async () => {
        let resolve: () => void = () => {};
        const { result } = renderHook(() => useAutosave(600));
        let flushed = false;

        act(() =>
            result.current.schedule(
                'q-1',
                () =>
                    new Promise<void>((done) => {
                        resolve = done;
                    }),
            ),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        await act(async () => {
            void result.current.flush().then(() => {
                flushed = true;
            });
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(flushed).toBe(false);

        await act(async () => {
            resolve();
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(flushed).toBe(true);
    });

    it('waits for the save in flight of a cancelled key', async () => {
        let resolve: () => void = () => {};
        const { result } = renderHook(() => useAutosave(600));
        let cancelled = false;

        act(() =>
            result.current.schedule(
                'q-1',
                () =>
                    new Promise<void>((done) => {
                        resolve = done;
                    }),
            ),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        await act(async () => {
            void result.current.cancel('q-1').then(() => {
                cancelled = true;
            });
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(cancelled).toBe(false);

        await act(async () => {
            resolve();
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(cancelled).toBe(true);
    });

    it('sends a second save of a key only once its first one answered', async () => {
        let resolveFirst: () => void = () => {};
        const first = vi.fn(
            () =>
                new Promise<void>((done) => {
                    resolveFirst = done;
                }),
        );
        const second = vi.fn(() => Promise.resolve());
        const { result } = renderHook(() => useAutosave(600));

        act(() => result.current.schedule('q-1', first));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        act(() => result.current.schedule('q-1', second));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        expect(second).not.toHaveBeenCalled();

        await act(async () => {
            resolveFirst();
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(second).toHaveBeenCalledTimes(1);
        expect(result.current.state.status).toBe('saved');
    });

    it('sends the pending saves when it unmounts', () => {
        const run = vi.fn(() => Promise.resolve());
        const { result, unmount } = renderHook(() => useAutosave(600));

        act(() => result.current.schedule('q-1', run));
        unmount();

        expect(run).toHaveBeenCalledTimes(1);
    });
});
