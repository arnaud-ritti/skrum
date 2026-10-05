import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ActionItemExtraFacets } from '@/components/action-items/action-item-facets';
import { ActionItemFilterBar } from '@/components/action-items/action-item-filters';
import { ActionItemFiltersDrawer } from '@/components/action-items/action-item-filters-drawer';
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

function withFacets(
    props: Partial<ComponentProps<typeof ActionItemFilterBar>> = {},
): ComponentProps<typeof ActionItemFilterBar> {
    const base = bar(props);

    return {
        ...base,
        extraFacets: (
            <ActionItemExtraFacets
                filters={base.filters}
                onChange={base.onChange}
            />
        ),
    };
}

describe('ActionItemFilterBar', () => {
    it('lists the facets in the order of the mockup, in a group', () => {
        renderWithProviders(<ActionItemFilterBar {...withFacets()} />);

        const toolbar = screen.getByRole('group', { name: 'Filters' });
        const facets = within(toolbar)
            .getAllByRole('combobox')
            .map((facet) => facet.getAttribute('aria-label'));

        expect(facets).toEqual([
            'Team',
            'Status',
            'Assignee',
            'Priority',
            'Due date',
            'Source',
        ]);

        const controls = [
            ...toolbar.querySelectorAll<HTMLElement>(
                '[role="combobox"], button',
            ),
        ].map(
            (control) =>
                control.getAttribute('aria-label') ??
                control.textContent?.replace(/\d+$/, ''),
        );

        expect(controls.indexOf('Overdue')).toBeGreaterThan(
            controls.indexOf('Source'),
        );
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
        expect(status.textContent).toContain('2 of 3');
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

    it('offers To do, In progress and Done as statuses, ticked one by one', async () => {
        const user = userEvent.setup();
        const props = bar();

        renderWithProviders(<ActionItemFilterBar {...props} />);

        const trigger = screen.getByRole('combobox', { name: 'Status' });

        expect(trigger.textContent).toContain('2 of 3');

        await user.click(trigger);

        const options = within(screen.getByRole('listbox'))
            .getAllByRole('option')
            .map((option) => option.textContent);

        expect(options).toEqual(['To do', 'In progress', 'Done status']);

        await user.click(screen.getByRole('option', { name: 'In progress' }));

        expect(props.onChange).toHaveBeenCalledWith({ status: ['todo'] });
    });

    it('reads plain when every status is ticked', () => {
        renderWithProviders(
            <ActionItemFilterBar
                {...bar({
                    filters: {
                        ...defaults,
                        status: ['todo', 'doing', 'completed'],
                    },
                    isDefault: false,
                })}
            />,
        );

        const status = screen.getByRole('combobox', { name: 'Status' });

        expect(status.textContent).not.toContain('of 3');
        expect(
            status.closest<HTMLElement>('[data-slot="action-filter"]')?.dataset
                .active,
        ).toBeUndefined();
    });

    it('keeps the last status ticked', async () => {
        const user = userEvent.setup();
        const props = bar({
            filters: { ...defaults, status: ['completed'] },
            isDefault: false,
        });

        renderWithProviders(<ActionItemFilterBar {...props} />);

        await user.click(screen.getByRole('combobox', { name: 'Status' }));
        await user.click(screen.getByRole('option', { name: 'Done status' }));

        expect(props.onChange).not.toHaveBeenCalled();
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

        expect(props.onChange).toHaveBeenLastCalledWith({ due: 'overdue' });

        rerender(
            <ActionItemFilterBar
                {...props}
                filters={{ ...defaults, due: 'overdue' }}
                isDefault={false}
            />,
        );

        const pressed = screen.getByRole('button', { name: /Overdue/ });

        expect(pressed.getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(pressed);

        expect(props.onChange).toHaveBeenLastCalledWith({ due: null });
    });

    it('offers Reset only when the page left its opening state', () => {
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

    it('hands the focus to the first facet when Reset goes away', () => {
        const props = bar({
            filters: { ...defaults, team: null },
            isDefault: false,
        });
        const { rerender } = renderWithProviders(
            <ActionItemFilterBar {...props} />,
        );

        const reset = screen.getByRole('button', { name: 'Reset' });

        reset.focus();
        fireEvent.click(reset);
        rerender(<ActionItemFilterBar {...bar()} />);

        expect(document.activeElement).toBe(
            screen.getByRole('combobox', { name: 'Team' }),
        );
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
        return within(screen.getAllByRole('group', { name: 'Filters' })[0]);
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

        expect(labels).toEqual(['Mine6', 'Overdue2', 'To do24', 'Done status']);
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
        expect(props.onChange).toHaveBeenLastCalledWith({ due: 'overdue' });

        fireEvent.click(chips().getByRole('button', { name: 'Done status' }));
        expect(props.onChange).toHaveBeenLastCalledWith({
            status: ['completed'],
            due: null,
        });
    });

    it('takes "Done" back to the open statuses on a second press', () => {
        const props = bar({
            filters: { ...defaults, status: ['completed'] },
            isDefault: false,
        });

        renderWithProviders(
            <ActionItemFiltersDrawer
                {...props}
                counts={counts}
                activeCount={1}
            />,
        );

        fireEvent.click(chips().getByRole('button', { name: 'Done status' }));

        expect(props.onChange).toHaveBeenLastCalledWith({
            status: defaults.status,
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

    it('lists the six facets in the drawer, one per line', async () => {
        renderWithProviders(
            <ActionItemFiltersDrawer
                {...withFacets()}
                counts={counts}
                activeCount={0}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

        const drawer = await screen.findByRole('dialog', { name: 'Filters' });

        expect(
            within(drawer)
                .getAllByRole('combobox')
                .map((facet) => facet.getAttribute('aria-label')),
        ).toEqual([
            'Team',
            'Status',
            'Assignee',
            'Priority',
            'Due date',
            'Source',
        ]);
        expect(
            within(drawer)
                .getByRole('combobox', { name: 'Priority' })
                .closest<HTMLElement>('[data-slot="action-filter"]')?.className,
        ).toContain('h-11');
    });

    it('holds the search at the top of the drawer, without its shortcut', async () => {
        const props = bar({ filters: { ...defaults, q: 'runbook' } });

        renderWithProviders(
            <ActionItemFiltersDrawer
                {...props}
                counts={counts}
                activeCount={1}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Filters · 1' }));

        const drawer = await screen.findByRole('dialog', { name: 'Filters' });
        const search = within(drawer).getByRole('searchbox', {
            name: 'Search action items',
        });

        expect((search as HTMLInputElement).value).toBe('runbook');
        expect(search.getAttribute('aria-keyshortcuts')).toBeNull();
        expect(
            search.compareDocumentPosition(
                within(drawer).getByRole('combobox', { name: 'Team' }),
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();

        fireEvent.keyDown(search, { key: 'Escape' });

        expect(props.onChange).toHaveBeenLastCalledWith({ q: null });
        expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy();
    });

    it('applies a term typed just before the drawer closes', async () => {
        const props = bar();

        renderWithProviders(
            <ActionItemFiltersDrawer
                {...props}
                counts={counts}
                activeCount={0}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

        const drawer = await screen.findByRole('dialog', { name: 'Filters' });

        fireEvent.change(
            within(drawer).getByRole('searchbox', {
                name: 'Search action items',
            }),
            { target: { value: 'wiki' } },
        );
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

        await vi.waitFor(() =>
            expect(
                screen.queryByRole('dialog', { name: 'Filters' }),
            ).toBeNull(),
        );
        expect(props.onChange).toHaveBeenLastCalledWith({ q: 'wiki' });
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
