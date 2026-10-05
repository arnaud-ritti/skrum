import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { BoardNotices } from './board-notices';
import type { BoardNoticesProps } from './board-notices';

function renderNotices(props: Partial<BoardNoticesProps> = {}) {
    const onResume = vi.fn();
    const view = renderWithProviders(
        <BoardNotices
            locked={false}
            leading={false}
            following={false}
            paused={false}
            onResume={onResume}
            {...props}
        />,
    );

    return { ...view, onResume };
}

describe('BoardNotices', () => {
    it('keeps an empty, hidden status when the board is calm, so that a notice is announced', () => {
        const { container, rerender } = renderNotices();
        const calm = container.querySelector('[role="status"]');

        expect(calm?.textContent).toBe('');
        expect(calm?.className).toContain('sr-only');

        rerender(
            <BoardNotices
                locked
                leading={false}
                following={false}
                paused={false}
                onResume={() => {}}
            />,
        );

        expect(container.querySelector('[role="status"]')).toBe(calm);
        expect(calm?.textContent).toBe('This board is locked.');
    });

    it('tells a viewer that the board is locked, in a div with the status role', () => {
        const { container } = renderNotices({ locked: true });
        const notice = container.querySelector('div[role="status"]');

        expect(notice?.textContent).toBe('This board is locked.');
    });

    it('tells the facilitator that everyone follows', () => {
        renderNotices({ leading: true });

        expect(screen.getByRole('status').textContent).toBe(
            'Everyone follows your view.',
        );
    });

    it('says who is followed, and offers Resume only while following is paused', () => {
        const { rerender, onResume } = renderNotices({ following: true });

        expect(screen.getByRole('status').textContent).toBe(
            'Following the facilitator',
        );
        expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();

        rerender(
            <BoardNotices
                locked={false}
                leading={false}
                following
                paused
                onResume={onResume}
            />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'Following paused',
        );
        expect(screen.getByRole('status').textContent).not.toContain(
            'Following the facilitator',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

        expect(onResume).toHaveBeenCalledTimes(1);
    });
});
