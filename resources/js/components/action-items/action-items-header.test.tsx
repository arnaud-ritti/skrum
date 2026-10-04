import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionItemsHeader } from '@/components/action-items/action-items-header';
import { renderWithProviders } from '@/test/render';

const counts = { open: 28, overdue: 4, completed: 12, mine: 6, rituals: 9 };

describe('ActionItemsHeader', () => {
    it('says what is open, what is overdue and from how many rituals', () => {
        renderWithProviders(
            <ActionItemsHeader
                counts={counts}
                grouping="none"
                onGroupingChange={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Action items' }),
        ).toBeTruthy();
        expect(
            screen.getByText('28 open · 4 overdue · from 9 rituals'),
        ).toBeTruthy();
    });

    it('writes one ritual in the singular', () => {
        renderWithProviders(
            <ActionItemsHeader
                counts={{ ...counts, rituals: 1 }}
                grouping="none"
                onGroupingChange={vi.fn()}
            />,
        );

        expect(
            screen.getByText('28 open · 4 overdue · from 1 ritual'),
        ).toBeTruthy();
    });

    it('writes one open item in the singular', () => {
        renderWithProviders(
            <ActionItemsHeader
                counts={{ ...counts, open: 1 }}
                grouping="none"
                onGroupingChange={vi.fn()}
            />,
        );

        expect(
            screen.getByText('1 open · 4 overdue · from 9 rituals'),
        ).toBeTruthy();
    });

    it('offers Sprint, Team, Assignee and None, in that order, and no Status', () => {
        const onGroupingChange = vi.fn();

        renderWithProviders(
            <ActionItemsHeader
                counts={counts}
                grouping="none"
                onGroupingChange={onGroupingChange}
            />,
        );

        const group = screen.getByRole('radiogroup', { name: 'Group by' });
        const options = within(group)
            .getAllByRole('radio')
            .map((option) => option.textContent);

        expect(options).toEqual(['Sprint', 'Team', 'Assignee', 'None']);

        fireEvent.click(screen.getByRole('radio', { name: 'Assignee' }));

        expect(onGroupingChange).toHaveBeenCalledWith('assignee');
    });

    it('shows no Select button unless the page asks for one', () => {
        renderWithProviders(
            <ActionItemsHeader
                counts={counts}
                grouping="none"
                onGroupingChange={vi.fn()}
            />,
        );

        expect(screen.queryByRole('button', { name: 'Select' })).toBeNull();
    });

    it('enters selection mode with Select, and leaves it with Finish selecting', () => {
        const onSelectingChange = vi.fn();
        const { rerender } = renderWithProviders(
            <ActionItemsHeader
                counts={counts}
                grouping="none"
                onGroupingChange={vi.fn()}
                selecting={false}
                onSelectingChange={onSelectingChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select' }));

        expect(onSelectingChange).toHaveBeenLastCalledWith(true);

        rerender(
            <ActionItemsHeader
                counts={counts}
                grouping="none"
                onGroupingChange={vi.fn()}
                selecting
                onSelectingChange={onSelectingChange}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Finish selecting' }),
        );

        expect(onSelectingChange).toHaveBeenLastCalledWith(false);
    });
});
