import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dropLineOf, TaskRow } from '@/components/poker/task-row';
import { pokerTask } from '@/test/poker-room';

const sortable = vi.hoisted(() => ({
    state: { isOver: false, isDragging: false, activeIndex: -1, index: 1 },
}));

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
    const original = await importOriginal<typeof import('@dnd-kit/sortable')>();

    return {
        ...original,
        useSortable: () => ({
            attributes: {},
            listeners: {},
            setNodeRef: () => {},
            setActivatorNodeRef: () => {},
            transform: null,
            transition: undefined,
            ...sortable.state,
        }),
    };
});

function row() {
    return render(
        <ol>
            <TaskRow
                task={pokerTask('t2', 'Password reset', { position: 2 })}
                round={null}
                sortable
                selectable
                onSelect={() => {}}
            />
        </ol>,
    );
}

function dropLine(): HTMLElement | null {
    return document.querySelector('[data-slot="task-drop-line"]');
}

beforeEach(() => {
    sortable.state = {
        isOver: false,
        isDragging: false,
        activeIndex: -1,
        index: 1,
    };
});

describe('dropLineOf', () => {
    it('puts the line after a row further down and before a row further up', () => {
        const over = { isOver: true, isDragging: false };

        expect(dropLineOf({ ...over, activeIndex: 0, index: 2 })).toBe('after');
        expect(dropLineOf({ ...over, activeIndex: 3, index: 2 })).toBe(
            'before',
        );
    });

    it('draws nothing on the dragged row, on a row that is not under it, or when nothing is dragged', () => {
        expect(
            dropLineOf({
                isOver: true,
                isDragging: true,
                activeIndex: 2,
                index: 2,
            }),
        ).toBeNull();
        expect(
            dropLineOf({
                isOver: false,
                isDragging: false,
                activeIndex: 0,
                index: 2,
            }),
        ).toBeNull();
        expect(
            dropLineOf({
                isOver: true,
                isDragging: false,
                activeIndex: -1,
                index: 2,
            }),
        ).toBeNull();
    });
});

describe('TaskRow, the drop line', () => {
    it('has none at rest', () => {
        row();

        expect(dropLine()).toBeNull();
    });

    it('shows a decorative line on the edge where the dragged row lands, inside the list item', () => {
        sortable.state = {
            isOver: true,
            isDragging: false,
            activeIndex: 0,
            index: 1,
        };
        const { container, unmount } = row();

        expect(dropLine()?.getAttribute('data-position')).toBe('after');
        expect(dropLine()?.getAttribute('aria-hidden')).toBe('true');
        expect(dropLine()?.parentElement?.tagName).toBe('LI');
        expect(container.querySelectorAll('ol > li')).toHaveLength(1);
        unmount();

        sortable.state = {
            isOver: true,
            isDragging: false,
            activeIndex: 3,
            index: 1,
        };
        row();

        expect(dropLine()?.getAttribute('data-position')).toBe('before');
    });

    it('marks the dragged row and draws no line on it', () => {
        sortable.state = {
            isOver: true,
            isDragging: true,
            activeIndex: 1,
            index: 1,
        };
        row();

        expect(dropLine()).toBeNull();
        expect(
            document
                .querySelector('[data-test="poker-task-row"]')
                ?.getAttribute('data-dragging'),
        ).toBe('true');
    });
});
