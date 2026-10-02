import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ActionItemFilterBar } from '@/components/action-items/action-item-filters';
import { ActionItemFiltersDrawer } from '@/components/action-items/action-item-filters-drawer';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import { renderWithProviders } from '@/test/render';

const defaults: ActionItemFilters = {
    status: 'open',
    assignee: null,
    team: null,
    item: null,
};
const counts = { open: 24, overdue: 2, completed: 9, mine: 6, rituals: 5 };

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

function bar(
    props: Partial<ComponentProps<typeof ActionItemFilterBar>> = {},
): ComponentProps<typeof ActionItemFilterBar> {
    return {
        filters: defaults,
        teams: [
            { id: 'team-1', name: 'Atlas' },
            { id: 'team-2', name: 'Mobile' },
        ],
        assignees: [{ id: 'user-2', name: 'Inès Benali' }],
        overdueCount: 2,
        isDefault: true,
        onChange: vi.fn(),
        onReset: vi.fn(),
        ...props,
    };
}

describe('ActionItemFilterBar', () => {
    it('lists the facets in the order of the mockup, in a toolbar', () => {
        renderWithProviders(<ActionItemFilterBar {...bar()} />);

        const toolbar = screen.getByRole('toolbar', { name: 'Filters' });
        const facets = within(toolbar)
            .getAllByRole('combobox')
            .map((facet) => facet.getAttribute('aria-label'));

        expect(facets).toEqual(['Team', 'Status', 'Assignee']);
    });

    it('shows the value of a facet that narrows the list', () => {
        renderWithProviders(
            <ActionItemFilterBar
                {...bar({
                    filters: { ...defaults, team: 'team-1' },
                    isDefault: false,
                })}
            />,
        );

        const team = screen.getByRole('combobox', { name: 'Team' });
        const status = screen.getByRole('combobox', { name: 'Status' });

        expect(team.textContent).toContain('Atlas');
        expect(
            team.closest<HTMLElement>('[data-slot="action-filter"]')?.dataset
                .active,
        ).toBe('true');
        expect(status.textContent).toContain('To do');
    });

    it('returns to every team from the cross of the team facet', () => {
        const props = bar({
            filters: { ...defaults, team: 'team-1' },
            isDefault: false,
        });

        renderWithProviders(<ActionItemFilterBar {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Show all teams' }));

        expect(props.onChange).toHaveBeenCalledWith({ team: null });
    });

    it('has no cross on a team facet that is off', () => {
        renderWithProviders(<ActionItemFilterBar {...bar()} />);

        expect(
            screen.queryByRole('button', { name: 'Show all teams' }),
        ).toBeNull();
    });

    it('offers To do, Done and All as statuses, and no Overdue', async () => {
        const user = userEvent.setup();
        const props = bar();

        renderWithProviders(<ActionItemFilterBar {...props} />);

        await user.click(screen.getByRole('combobox', { name: 'Status' }));

        const options = within(screen.getByRole('listbox'))
            .getAllByRole('option')
            .map((option) => option.textContent);

        expect(options).toEqual(['To do', 'Done', 'All']);

        await user.click(screen.getByRole('option', { name: 'Done' }));

        expect(props.onChange).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('filters by assignee: anyone, me, unassigned, then each person', async () => {
        const user = userEvent.setup();
        const props = bar();

        renderWithProviders(<ActionItemFilterBar {...props} />);

        await user.click(screen.getByRole('combobox', { name: 'Assignee' }));

        const options = within(screen.getByRole('listbox'))
            .getAllByRole('option')
            .map((option) => option.textContent);

        expect(options).toEqual(['Anyone', 'Me', 'Unassigned', 'Inès Benali']);

        await user.click(screen.getByRole('option', { name: 'Me' }));

        expect(props.onChange).toHaveBeenCalledWith({ assignee: 'me' });
    });

    it('turns the overdue shortcut on and off, with its count', () => {
        const props = bar();
        const { rerender } = renderWithProviders(
            <ActionItemFilterBar {...props} />,
        );
        const shortcut = screen.getByRole('button', { name: /Overdue/ });

        expect(shortcut.textContent).toContain('2');
        expect(shortcut.getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(shortcut);

        expect(props.onChange).toHaveBeenLastCalledWith({ status: 'overdue' });

        rerender(
            <ActionItemFilterBar
                {...props}
                filters={{ ...defaults, status: 'overdue' }}
                isDefault={false}
            />,
        );

        const pressed = screen.getByRole('button', { name: /Overdue/ });

        expect(pressed.getAttribute('aria-pressed')).toBe('true');
        expect(
            screen.getByRole('combobox', { name: 'Status' }).textContent,
        ).toContain('To do');

        fireEvent.click(pressed);

        expect(props.onChange).toHaveBeenLastCalledWith({ status: 'open' });
    });

    it('offers Reset only when a facet narrows the list', () => {
        const props = bar({
            filters: { ...defaults, assignee: 'me' },
            isDefault: false,
        });
        const { rerender } = renderWithProviders(
            <ActionItemFilterBar {...props} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

        expect(props.onReset).toHaveBeenCalledTimes(1);

        rerender(<ActionItemFilterBar {...bar()} />);

        expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    });

    it('leaves the place of the later facets after Assignee', () => {
        renderWithProviders(
            <ActionItemFilterBar
                {...bar({ extraFacets: <span data-testid="later" /> })}
            />,
        );

        const assignee = screen
            .getByRole('combobox', { name: 'Assignee' })
            .closest('[data-slot="action-filter"]');

        expect(assignee?.nextElementSibling).toBe(screen.getByTestId('later'));
    });
});

describe('ActionItemFiltersDrawer', () => {
    function chips() {
        return within(screen.getAllByRole('toolbar', { name: 'Filters' })[0]);
    }

    it('shows the shortcuts as chips with their numbers', () => {
        renderWithProviders(
            <ActionItemFiltersDrawer
                {...bar()}
                counts={counts}
                activeCount={0}
            />,
        );

        const labels = chips()
            .getAllByRole('button')
            .map((chip) => chip.textContent);

        expect(labels).toEqual(['Mine6', 'Overdue2', 'To do24', 'Done']);
        expect(
            chips()
                .getByRole('button', { name: /To do/ })
                .getAttribute('aria-pressed'),
        ).toBe('true');
    });

    it('applies a chip, and takes "Mine" back on a second press', () => {
        const props = bar({ filters: { ...defaults, assignee: 'me' } });

        renderWithProviders(
            <ActionItemFiltersDrawer
                {...props}
                counts={counts}
                activeCount={1}
            />,
        );

        fireEvent.click(chips().getByRole('button', { name: /Mine/ }));
        expect(props.onChange).toHaveBeenLastCalledWith({ assignee: null });

        fireEvent.click(chips().getByRole('button', { name: /Overdue/ }));
        expect(props.onChange).toHaveBeenLastCalledWith({ status: 'overdue' });

        fireEvent.click(chips().getByRole('button', { name: 'Done' }));
        expect(props.onChange).toHaveBeenLastCalledWith({
            status: 'completed',
        });
    });

    it('opens the facets in a drawer from "Filters · n"', async () => {
        renderWithProviders(
            <ActionItemFiltersDrawer
                {...bar({
                    filters: { ...defaults, team: 'team-1', assignee: 'me' },
                    isDefault: false,
                })}
                counts={counts}
                activeCount={2}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Filters · 2' }));

        const drawer = await screen.findByRole('dialog', { name: 'Filters' });

        expect(
            within(drawer).getByRole('combobox', { name: 'Team' }),
        ).toBeTruthy();
        expect(
            within(drawer).getByRole('button', { name: 'Reset' }),
        ).toBeTruthy();
    });

    it('names the button "Filters" when no facet is on', () => {
        renderWithProviders(
            <ActionItemFiltersDrawer
                {...bar()}
                counts={counts}
                activeCount={0}
            />,
        );

        expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
    });
});
