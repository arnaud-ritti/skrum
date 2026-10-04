import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CircleDot } from 'lucide-react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
    ActionItemExtraFacets,
    MultiFacet,
} from '@/components/action-items/action-item-facets';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import { renderWithProviders } from '@/test/render';

const defaults: ActionItemFilters = {
    status: ['todo', 'doing'],
    priority: [],
    due: null,
    source: null,
    assignee: null,
    team: null,
    item: null,
};

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

const statuses = [
    { value: 'todo', label: 'To do' },
    { value: 'doing', label: 'In progress' },
    { value: 'completed', label: 'Done' },
] as const;

describe('MultiFacet', () => {
    it('reads the one value, or how many of the options are ticked', () => {
        const { rerender } = renderWithProviders(
            <MultiFacet
                label="Status"
                icon={CircleDot}
                options={[...statuses]}
                value={['todo', 'doing']}
                allValue={['todo', 'doing', 'completed']}
                onChange={vi.fn()}
            />,
        );

        const trigger = screen.getByRole('combobox', { name: 'Status' });

        expect(trigger.textContent).toContain('2 of 3');
        expect(
            trigger.closest<HTMLElement>('[data-slot="action-filter"]')?.dataset
                .active,
        ).toBe('true');

        rerender(
            <MultiFacet
                label="Status"
                icon={CircleDot}
                options={[...statuses]}
                value={['completed']}
                allValue={['todo', 'doing', 'completed']}
                onChange={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('combobox', { name: 'Status' }).textContent,
        ).toContain('Done');

        rerender(
            <MultiFacet
                label="Status"
                icon={CircleDot}
                options={[...statuses]}
                value={['todo', 'doing', 'completed']}
                allValue={['todo', 'doing', 'completed']}
                onChange={vi.fn()}
            />,
        );

        const plain = screen.getByRole('combobox', { name: 'Status' });

        expect(plain.textContent).not.toContain('of 3');
        expect(
            plain.closest<HTMLElement>('[data-slot="action-filter"]')?.dataset
                .active,
        ).toBeUndefined();
    });

    it('ticks and unticks an option, and refuses to untick the last one', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = renderWithProviders(
            <MultiFacet
                label="Status"
                icon={CircleDot}
                options={[...statuses]}
                value={['todo', 'doing']}
                allValue={['todo', 'doing', 'completed']}
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole('combobox', { name: 'Status' }));

        const options = within(screen.getByRole('listbox'))
            .getAllByRole('option')
            .map((option) => [
                option.textContent,
                option.getAttribute('aria-checked'),
            ]);

        expect(options).toEqual([
            ['To do', 'true'],
            ['In progress', 'true'],
            ['Done', 'false'],
        ]);

        await user.click(screen.getByRole('option', { name: 'In progress' }));

        expect(onChange).toHaveBeenLastCalledWith(['todo']);

        rerender(
            <MultiFacet
                label="Status"
                icon={CircleDot}
                options={[...statuses]}
                value={['todo']}
                allValue={['todo', 'doing', 'completed']}
                onChange={onChange}
            />,
        );
        onChange.mockClear();

        await user.click(screen.getByRole('option', { name: 'To do' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('ticks an option from the keyboard: the arrows move, Enter ticks', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(
            <MultiFacet
                label="Status"
                icon={CircleDot}
                options={[...statuses]}
                value={['todo', 'doing']}
                allValue={['todo', 'doing', 'completed']}
                onChange={onChange}
            />,
        );

        screen.getByRole('combobox', { name: 'Status' }).focus();
        await user.keyboard('{Enter}');
        await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

        expect(onChange).toHaveBeenLastCalledWith([
            'todo',
            'doing',
            'completed',
        ]);
    });

    it('moves focus to the named list on open so a screen reader follows the active option', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <MultiFacet
                label="Status"
                icon={CircleDot}
                options={[...statuses]}
                value={['todo', 'doing']}
                allValue={['todo', 'doing', 'completed']}
                onChange={vi.fn()}
            />,
        );

        screen.getByRole('combobox', { name: 'Status' }).focus();
        await user.keyboard('{Enter}');
        const focusedOnOpen = document.activeElement;
        await user.keyboard('{ArrowDown}');

        const list = screen.getByRole('listbox', { name: 'Status' });

        expect(focusedOnOpen).toBe(list);
        expect(list.getAttribute('aria-activedescendant')).toBe(
            screen.getByRole('option', { name: 'In progress' }).id,
        );
    });

    it('names its list and points the trigger at it', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <MultiFacet
                label="Status"
                icon={CircleDot}
                options={[...statuses]}
                value={['todo', 'doing']}
                allValue={['todo', 'doing', 'completed']}
                onChange={vi.fn()}
            />,
        );

        const trigger = screen.getByRole('combobox', { name: 'Status' });

        await user.click(trigger);

        const list = screen.getByRole('listbox', { name: 'Status' });

        expect(trigger.getAttribute('aria-controls')).toBe(list.id);
    });
});

describe('ActionItemExtraFacets', () => {
    it('renders Priority, Due date and Source in that order', () => {
        renderWithProviders(
            <ActionItemExtraFacets filters={defaults} onChange={vi.fn()} />,
        );

        expect(
            screen
                .getAllByRole('combobox')
                .map((facet) => facet.getAttribute('aria-label')),
        ).toEqual(['Priority', 'Due date', 'Source']);
    });

    it('sends the priorities ticked, each with its mark', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(
            <ActionItemExtraFacets
                filters={{ ...defaults, priority: ['high'] }}
                onChange={onChange}
            />,
        );

        const trigger = screen.getByRole('combobox', { name: 'Priority' });

        expect(trigger.textContent).toContain('High');

        await user.click(trigger);

        const listbox = screen.getByRole('listbox');

        expect(
            within(listbox)
                .getAllByRole('option')
                .map((option) => option.textContent),
        ).toEqual(['High', 'Medium', 'Low']);
        expect(
            listbox.querySelectorAll('[data-slot="action-item-priority"]'),
        ).toHaveLength(3);

        await user.click(screen.getByRole('option', { name: 'Low' }));

        expect(onChange).toHaveBeenLastCalledWith({
            priority: ['high', 'low'],
        });
    });

    it('sends every priority as none', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(
            <ActionItemExtraFacets
                filters={{ ...defaults, priority: ['high', 'medium'] }}
                onChange={onChange}
            />,
        );

        expect(
            screen.getByRole('combobox', { name: 'Priority' }).textContent,
        ).toContain('2 of 3');

        await user.click(screen.getByRole('combobox', { name: 'Priority' }));
        await user.click(screen.getByRole('option', { name: 'Low' }));

        expect(onChange).toHaveBeenLastCalledWith({ priority: [] });
    });

    it('clears the priorities from the cross', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(
            <ActionItemExtraFacets
                filters={{ ...defaults, priority: ['high'] }}
                onChange={onChange}
            />,
        );

        await user.click(
            screen.getByRole('button', { name: 'Clear priority' }),
        );

        expect(onChange).toHaveBeenLastCalledWith({ priority: [] });
    });

    it('picks a due date bucket, and clears it from the cross', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = renderWithProviders(
            <ActionItemExtraFacets filters={defaults} onChange={onChange} />,
        );

        await user.click(screen.getByRole('combobox', { name: 'Due date' }));

        expect(
            within(screen.getByRole('listbox'))
                .getAllByRole('option')
                .map((option) => option.textContent),
        ).toEqual([
            'Any',
            'Overdue',
            'Today',
            'Next 7 days',
            'Later',
            'No due date',
        ]);

        await user.click(screen.getByRole('option', { name: 'Next 7 days' }));

        expect(onChange).toHaveBeenLastCalledWith({ due: 'week' });

        rerender(
            <ActionItemExtraFacets
                filters={{ ...defaults, due: 'week' }}
                onChange={onChange}
            />,
        );

        expect(
            screen.getByRole('combobox', { name: 'Due date' }).textContent,
        ).toContain('Next 7 days');

        await user.click(
            screen.getByRole('button', { name: 'Clear due date' }),
        );

        expect(onChange).toHaveBeenLastCalledWith({ due: null });
    });

    it('picks a source, and clears it from the cross', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = renderWithProviders(
            <ActionItemExtraFacets filters={defaults} onChange={onChange} />,
        );

        await user.click(screen.getByRole('combobox', { name: 'Source' }));

        expect(
            within(screen.getByRole('listbox'))
                .getAllByRole('option')
                .map((option) => option.textContent),
        ).toEqual(['Any', 'From a retro', 'Added outside a retro']);

        await user.click(
            screen.getByRole('option', { name: 'Added outside a retro' }),
        );

        expect(onChange).toHaveBeenLastCalledWith({ source: 'outside' });

        rerender(
            <ActionItemExtraFacets
                filters={{ ...defaults, source: 'outside' }}
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Clear source' }));

        expect(onChange).toHaveBeenLastCalledWith({ source: null });
    });
});
