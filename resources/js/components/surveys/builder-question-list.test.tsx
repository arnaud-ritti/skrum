import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
});
