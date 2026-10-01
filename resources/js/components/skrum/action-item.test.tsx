import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    ActionItem,
    isActionOverdue,
    nextActionStatus,
} from '@/components/skrum/action-item';
import { renderWithProviders } from '@/test/render';

const base = {
    id: 'a1',
    title: 'Limit PRs to 400 lines',
    status: 'open' as const,
    priority: 'high' as const,
    today: '2026-10-10',
};

describe('ActionItem logic', () => {
    it('cycles status, with doing only when enabled', () => {
        expect(nextActionStatus('open', false)).toBe('completed');
        expect(nextActionStatus('open', true)).toBe('doing');
        expect(nextActionStatus('doing', true)).toBe('completed');
        expect(nextActionStatus('completed', true)).toBe('open');
    });

    it('is overdue only when past due and not completed', () => {
        expect(isActionOverdue('2026-10-09', 'open', '2026-10-10')).toBe(true);
        expect(isActionOverdue('2026-10-10', 'open', '2026-10-10')).toBe(false);
        expect(isActionOverdue('2026-10-09', 'completed', '2026-10-10')).toBe(
            false,
        );
        expect(isActionOverdue(null, 'open', '2026-10-10')).toBe(false);
    });
});

describe('ActionItem', () => {
    it('shows the priority as text and the status button advances', () => {
        const onStatusChange = vi.fn();
        renderWithProviders(
            <ActionItem {...base} onStatusChange={onStatusChange} />,
        );

        expect(screen.getByText('High')).toBeTruthy();
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Status: To do. Mark as Done',
            }),
        );
        expect(onStatusChange).toHaveBeenCalledWith('completed');
    });

    it('strikes a completed title and offers to reopen', () => {
        renderWithProviders(
            <ActionItem {...base} status="completed" doneAt="2026-09-22" />,
        );

        expect(
            screen.getByText(base.title).className.includes('line-through'),
        ).toBe(true);
        expect(
            screen.getByRole('button', { name: /Mark as To do/ }),
        ).toBeTruthy();
    });

    it('flags an overdue item in text', () => {
        renderWithProviders(<ActionItem {...base} dueDate="2026-09-26" />);

        expect(screen.getAllByText(/Overdue/).length).toBeGreaterThan(0);
    });

    it('shows a safe external ticket link with a descriptive name', () => {
        renderWithProviders(
            <ActionItem
                {...base}
                ticket={{
                    provider: 'jira',
                    key: 'ATLAS-1287',
                    url: 'https://example.test/ATLAS-1287',
                }}
            />,
        );

        const link = screen.getByRole('link', {
            name: 'Open ATLAS-1287 in Jira',
        });
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
    });

    it('renders the link-ticket control only when a callback is given', () => {
        const onLinkTicket = vi.fn();
        const { rerender } = renderWithProviders(<ActionItem {...base} />);
        expect(screen.queryByText('Link a ticket')).toBeNull();

        rerender(<ActionItem {...base} onLinkTicket={onLinkTicket} />);
        fireEvent.click(screen.getByText('Link a ticket'));
        expect(onLinkTicket).toHaveBeenCalled();
    });

    it('marks a missing owner as unassigned', () => {
        renderWithProviders(<ActionItem {...base} />);

        expect(screen.getByRole('img', { name: 'Unassigned' })).toBeTruthy();
    });

    it('handles Space, Enter on the row', () => {
        const onStatusChange = vi.fn();
        const onEditStart = vi.fn();
        renderWithProviders(
            <ActionItem
                {...base}
                onStatusChange={onStatusChange}
                onEditStart={onEditStart}
            />,
        );
        const row = screen.getByRole('listitem');

        fireEvent.keyDown(row, { key: ' ' });
        fireEvent.keyDown(row, { key: 'Enter' });

        expect(onStatusChange).toHaveBeenCalledWith('completed');
        expect(onEditStart).toHaveBeenCalled();
    });

    it('saves with Ctrl+Enter, cancels with Escape, and rejects an empty title', () => {
        const onChange = vi.fn();
        const onEditCancel = vi.fn();
        renderWithProviders(
            <ActionItem
                {...base}
                editing
                onChange={onChange}
                onEditCancel={onEditCancel}
            />,
        );
        const input = screen.getByLabelText('Action title');

        fireEvent.change(input, { target: { value: '  ' } });
        fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: 'New title' } });
        fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'New title', priority: 'high' }),
        );

        fireEvent.keyDown(input, { key: 'Escape' });
        expect(onEditCancel).toHaveBeenCalled();
    });
});
