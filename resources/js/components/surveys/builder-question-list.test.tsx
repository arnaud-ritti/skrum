import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuilderQuestionList } from '@/components/surveys/builder-question-list';
import type { SurveyQuestionPayload } from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';

function question(id: string, label: string): SurveyQuestionPayload {
    return {
        id,
        kind: 'text',
        label,
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
    };
}

const questions = [
    question('a', 'Workload'),
    question('b', 'Recommendation'),
    question('c', 'Ritual'),
];

function list(
    items: SurveyQuestionPayload[],
    onReorder: (ids: string[]) => void,
) {
    return (
        <BuilderQuestionList
            questions={items}
            sortable
            onReorder={onReorder}
            renderCard={(item, index, handle) => (
                <div data-test="row">
                    {handle}
                    <span>{`${index + 1}. ${item.label}`}</span>
                </div>
            )}
        />
    );
}

function renderList(sortable = true, onReorder = vi.fn()) {
    renderWithProviders(
        <BuilderQuestionList
            questions={questions}
            sortable={sortable}
            onReorder={onReorder}
            renderCard={(item, index, handle) => (
                <div data-test="row">
                    {handle}
                    <span>{`${index + 1}. ${item.label}`}</span>
                </div>
            )}
        />,
    );

    return onReorder;
}

function rows(): string[] {
    return screen.getAllByRole('listitem').map((row) => row.textContent ?? '');
}

function announcement(): string {
    return (
        document.querySelector('[data-slot="questions-announcement"]')
            ?.textContent ?? ''
    );
}

/** Firefox and Safari blur a focused node that the DOM moves; jsdom does not. */
function blurOnMove(): void {
    const insertBefore = Object.getOwnPropertyDescriptor(
        Node.prototype,
        'insertBefore',
    )?.value as (this: Node, node: Node, child: Node | null) => Node;
    const blurIfMoved = (node: Node): void => {
        const active = document.activeElement;

        if (active instanceof HTMLElement && node.contains(active)) {
            active.blur();
        }
    };

    vi.spyOn(Node.prototype, 'insertBefore').mockImplementation(function <
        T extends Node,
    >(this: Node, node: T, child: Node | null): T {
        blurIfMoved(node);

        return insertBefore.call(this, node, child) as T;
    });
    vi.spyOn(Node.prototype, 'appendChild').mockImplementation(function <
        T extends Node,
    >(this: Node, node: T): T {
        blurIfMoved(node);

        return insertBefore.call(this, node, null) as T;
    });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('BuilderQuestionList', () => {
    it('lists the questions in an ordered list with a handle each', () => {
        renderList();

        expect(rows()).toEqual([
            '1. Workload',
            '2. Recommendation',
            '3. Ritual',
        ]);
        expect(
            screen.getByRole('button', { name: 'Reorder question 2' }),
        ).toBeTruthy();
    });

    it('reorders with the keyboard and saves the order once, on the drop', () => {
        const onReorder = renderList();
        const handle = screen.getByRole('button', {
            name: 'Reorder question 1',
        });

        handle.focus();
        fireEvent.keyDown(handle, { key: ' ' });

        expect(announcement()).toBe('Picked up “Workload”, position 1 of 3');
        expect(handle.getAttribute('aria-pressed')).toBe('true');

        fireEvent.keyDown(handle, { key: 'ArrowDown' });

        expect(rows()).toEqual([
            '1. Recommendation',
            '2. Workload',
            '3. Ritual',
        ]);
        expect(announcement()).toBe('“Workload” moved to position 2 of 3');
        expect(onReorder).not.toHaveBeenCalled();

        fireEvent.keyDown(document.activeElement as Element, { key: ' ' });

        expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
        expect(announcement()).toBe('“Workload” dropped at position 2 of 3');
    });

    it('keeps the grabbed handle focused and grabbed when the browser blurs the moved question', () => {
        blurOnMove();
        const onReorder = renderList();
        const handle = screen.getByRole('button', {
            name: 'Reorder question 1',
        });

        handle.focus();
        fireEvent.keyDown(handle, { key: ' ' });
        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowDown',
        });
        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowDown',
        });

        expect(rows()).toEqual([
            '1. Recommendation',
            '2. Ritual',
            '3. Workload',
        ]);
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
            'Reorder question 3',
        );
        expect(document.activeElement?.getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(onReorder).not.toHaveBeenCalled();

        fireEvent.keyDown(document.activeElement as Element, { key: ' ' });

        expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
    });

    it('puts the question back on Escape', () => {
        const onReorder = renderList();
        const handle = screen.getByRole('button', {
            name: 'Reorder question 2',
        });

        fireEvent.keyDown(handle, { key: 'Enter' });
        fireEvent.keyDown(handle, { key: 'ArrowUp' });
        fireEvent.keyDown(window, { key: 'Escape' });

        expect(rows()).toEqual([
            '1. Workload',
            '2. Recommendation',
            '3. Ritual',
        ]);
        expect(announcement()).toBe(
            'Move cancelled, “Recommendation” back at position 2 of 3',
        );
        expect(onReorder).not.toHaveBeenCalled();
    });

    it('saves nothing when the question is dropped where it was', () => {
        const onReorder = renderList();
        const handle = screen.getByRole('button', {
            name: 'Reorder question 1',
        });

        fireEvent.keyDown(handle, { key: ' ' });
        fireEvent.keyDown(handle, { key: 'ArrowUp' });
        fireEvent.keyDown(handle, { key: ' ' });

        expect(onReorder).not.toHaveBeenCalled();
    });

    it('has no handle when the questions cannot move', () => {
        renderList(false);

        expect(screen.queryByRole('button')).toBeNull();
        expect(rows()).toHaveLength(3);
    });

    it('announces an untitled question by its placeholder', () => {
        renderWithProviders(list([question('a', ' '), questions[1]], vi.fn()));

        const handle = screen.getByRole('button', {
            name: 'Reorder question 1',
        });

        handle.focus();
        fireEvent.keyDown(handle, { key: ' ' });

        expect(announcement()).toBe(
            'Picked up “Untitled question”, position 1 of 2',
        );
    });

    it('keeps the questions added or removed during a keyboard move', () => {
        const onReorder = vi.fn();
        const { rerender } = renderWithProviders(list(questions, onReorder));
        const handle = screen.getByRole('button', {
            name: 'Reorder question 1',
        });

        handle.focus();
        fireEvent.keyDown(handle, { key: ' ' });
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        rerender(
            list(
                [questions[0], questions[1], question('d', 'Mood')],
                onReorder,
            ),
        );

        expect(rows()).toEqual(['1. Recommendation', '2. Workload', '3. Mood']);

        fireEvent.keyDown(document.activeElement as Element, { key: ' ' });

        expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'd']);
    });
});
