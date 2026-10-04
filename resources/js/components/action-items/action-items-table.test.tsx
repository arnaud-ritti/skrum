import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionItemsTable } from '@/components/action-items/action-items-table';
import type { ActionItemRowContext } from '@/components/action-items/action-items-table';
import { ActionItemMutationsContext } from '@/components/action-items/use-action-item-mutations';
import type { ActionItem } from '@/lib/retro/types';
import {
    actionItemFixture,
    actionItemMutationsFixture,
    actionItemViewerFixture,
} from '@/test/action-items';
import { renderWithProviders } from '@/test/render';
import type { ExportSource, ExternalLink } from '@/types/integrations';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string;
            children: React.ReactNode;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

const jira: ExportSource = {
    source: 'jira',
    label: 'Jira',
    integrationId: 'integration-1',
};

const link: ExternalLink = {
    id: 'link-1',
    source: 'jira',
    key: 'PROJ-42',
    url: 'https://acme.atlassian.net/browse/PROJ-42',
    state: 'open',
    statusName: null,
    syncState: 'off',
    syncError: null,
    lastSyncedAt: null,
};

function context(
    overrides: Partial<ActionItemRowContext> = {},
): ActionItemRowContext {
    return {
        viewer: actionItemViewerFixture(),
        locale: 'en',
        today: '2026-09-30',
        showTeam: false,
        teamName: () => 'Atlas',
        membersOf: () => [],
        scope: { workspace: 'acme', canManagePeople: false },
        sourcesOf: () => [],
        busyId: null,
        onStatusChange: vi.fn(),
        onDelete: vi.fn(),
        onRetrySync: vi.fn(),
        ...overrides,
    };
}

function renderTable(
    items: ActionItem[],
    props: Partial<ComponentProps<typeof ActionItemsTable>> = {},
) {
    const onOpen = vi.fn();
    const ctx = props.context ?? context();

    renderWithProviders(
        <ActionItemMutationsContext value={actionItemMutationsFixture()}>
            <ActionItemsTable
                groups={
                    items.length === 0 ? [] : [{ key: 'all', label: '', items }]
                }
                onOpen={onOpen}
                {...props}
                context={ctx}
            />
        </ActionItemMutationsContext>,
    );

    return { onOpen, ctx };
}

function row(id: string): HTMLElement {
    const element = document.getElementById(`action-item-${id}`);

    if (element === null) {
        throw new Error(`No row for ${id}.`);
    }

    return element;
}

describe('ActionItemsTable', () => {
    it('has the columns of the mockup, the first one left for the selection', () => {
        renderTable([actionItemFixture()]);

        const heads = screen
            .getAllByRole('columnheader')
            .map((head) => head.textContent);

        expect(heads).toEqual([
            'Select',
            'Action',
            'Status',
            'Assignee',
            'Priority',
            'Due',
            'Ticket',
            'More',
        ]);
        expect(row('item-1').querySelector('td')?.textContent).toBe('');
        expect(screen.getAllByRole('row')[0].querySelector('td')).toBeNull();
    });

    it('is a table row per item, under the id the links point to', () => {
        renderTable([
            actionItemFixture({ id: 'a' }),
            actionItemFixture({ id: 'b', content: 'Write the runbook' }),
        ]);

        expect(row('a').tagName).toBe('TR');
        expect(row('b').textContent).toContain('Write the runbook');
    });

    it('opens the details from the title', () => {
        const item = actionItemFixture();
        const { onOpen } = renderTable([item]);

        fireEvent.click(
            screen.getByRole('button', { name: 'Quarantine the flaky tests' }),
        );

        expect(onOpen).toHaveBeenCalledWith(item);
    });

    it('says where an item comes from, and nothing else, under its title', () => {
        renderTable([
            actionItemFixture({
                id: 'retro',
                recurrence: 'weekly',
                themeName: 'Quality',
                source: {
                    retroTitle: 'Sprint 42',
                    retroCreatedAt: null,
                    retroUrl: '/retros/r1',
                },
            }),
            actionItemFixture({ id: 'outside', retroId: null }),
        ]);

        const source = row('retro').querySelector(
            '[data-slot="action-row-source"]',
        );

        expect(source?.textContent).toBe('Sprint 42');
        expect(
            within(row('retro'))
                .getByRole('link', { name: 'Sprint 42' })
                .getAttribute('href'),
        ).toBe('/retros/r1');
        expect(row('retro').textContent).not.toContain('Alice Martin');
        expect(row('retro').textContent).not.toContain('Quality');
        expect(row('outside').textContent).toContain('Added outside a retro');
    });

    it('names the team of a row while no team filter is on', () => {
        renderTable([actionItemFixture()], {
            context: context({ showTeam: true }),
        });

        expect(
            row('item-1').querySelector('[data-slot="action-row-source"]')
                ?.textContent,
        ).toBe('Atlas ·Added outside a retro');
    });

    it('reads, names and advances each of the three statuses from the badge', () => {
        const { ctx } = renderTable([
            actionItemFixture({ id: 'open' }),
            actionItemFixture({
                id: 'doing',
                status: 'doing',
                startedAt: '2026-09-28T10:00:00Z',
            }),
            actionItemFixture({
                id: 'done',
                status: 'completed',
                completedAt: '2026-09-29T10:00:00Z',
            }),
        ]);

        const start = within(row('open')).getByRole('button', {
            name: 'Mark as in progress',
        });

        expect(start.textContent).toBe('To do');

        fireEvent.click(start);

        expect(ctx.onStatusChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 'open' }),
            'doing',
        );

        const complete = within(row('doing')).getByRole('button', {
            name: 'Mark as done',
        });

        expect(complete.textContent).toBe('In progress');

        fireEvent.click(complete);

        expect(ctx.onStatusChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 'doing' }),
            'completed',
        );

        const reopen = within(row('done')).getByRole('button', {
            name: 'Reopen',
        });

        expect(reopen.textContent).toBe('Done status');

        fireEvent.click(reopen);

        expect(ctx.onStatusChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 'done' }),
            'open',
        );
        expect(row('done').dataset.done).toBe('true');
    });

    it('keeps the status of an overdue item as "To do": the Due cell says the delay', () => {
        renderTable([
            actionItemFixture({ dueOn: '2026-09-26', isOverdue: true }),
        ]);

        expect(
            within(row('item-1')).getByRole('button', {
                name: 'Mark as in progress',
            }).textContent,
        ).toBe('To do');
        expect(
            row('item-1').querySelector('[data-slot="action-row-due"]')
                ?.textContent,
        ).toBe('Overdue · Sep 26');
        expect(row('item-1').dataset.late).toBe('true');
    });

    it('does not let a viewer without rights complete an item, nor edit it', async () => {
        const { ctx } = renderTable([actionItemFixture({ isMine: false })]);
        const status = within(row('item-1')).getByRole('button', {
            name: 'Mark as in progress',
        });

        expect(status.getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(status);

        expect(ctx.onStatusChange).not.toHaveBeenCalled();

        status.focus();

        expect(
            await screen.findByRole('tooltip', {
                name: 'You cannot change this action item',
            }),
        ).toBeTruthy();
        expect(
            within(row('item-1')).queryByRole('button', {
                name: 'More actions',
            }),
        ).toBeNull();
    });

    it('writes the due date as the mockup does', () => {
        renderTable([
            actionItemFixture({ id: 'later', dueOn: '2026-10-09' }),
            actionItemFixture({ id: 'soon', dueOn: '2026-10-02' }),
            actionItemFixture({ id: 'none', dueOn: null }),
            actionItemFixture({
                id: 'done',
                dueOn: '2026-09-20',
                status: 'completed',
                completedAt: '2026-09-29T10:00:00Z',
            }),
        ]);

        const due = (id: string) =>
            row(id).querySelector<HTMLElement>('[data-slot="action-row-due"]');

        expect(due('later')?.textContent).toBe('Fri, Oct 9');
        expect(due('soon')?.textContent).toBe('Fri, Oct 2 · in 2 days');
        expect(due('soon')?.dataset.due).toBe('soon');
        expect(due('none')?.textContent).toBe('No due date');
        expect(due('done')?.textContent).toBe('Done on Sep 29');
    });

    it('marks a repeating item with an icon beside its date', () => {
        renderTable([
            actionItemFixture({ dueOn: '2026-10-09', recurrence: 'weekly' }),
        ]);

        expect(
            within(row('item-1')).getByRole('img', { name: 'Repeats weekly' }),
        ).toBeTruthy();
    });

    it('shows the assignee, a guest marked "(Guest)", or "Unassigned"', () => {
        renderTable([
            actionItemFixture({ id: 'none' }),
            actionItemFixture({
                id: 'guest',
                assignee: {
                    kind: 'guest',
                    id: 'p1',
                    name: 'Carol Guest',
                    avatarUrl: '/avatars/carol.svg',
                    isTeamMember: false,
                },
            }),
        ]);

        const owner = (id: string) =>
            row(id).querySelector('[data-slot="action-row-owner"]')
                ?.textContent;

        expect(owner('none')).toBe('Unassigned');
        expect(owner('guest')).toContain('Carol Guest (Guest)');
    });

    it('links the ticket of an item, and offers the export of one without', () => {
        renderTable(
            [
                actionItemFixture({ id: 'linked', externalLinks: [link] }),
                actionItemFixture({ id: 'bare' }),
            ],
            { context: context({ sourcesOf: () => [jira] }) },
        );

        expect(
            row('linked')
                .querySelector('a[data-slot="action-item-link"]')
                ?.getAttribute('href'),
        ).toBe(link.url);
        expect(
            within(row('linked')).queryByRole('button', {
                name: 'Export to Jira',
            }),
        ).toBeNull();
        expect(
            within(row('bare')).getByRole('button', { name: 'Export to Jira' }),
        ).toBeTruthy();
    });

    it('writes a dash for an item without ticket and without tracker', () => {
        renderTable([actionItemFixture()]);

        expect(
            row('item-1').querySelector('[data-slot="action-row-ticket"]')
                ?.textContent,
        ).toBe('—');
    });

    it('opens the details from "Edit" in the "…" menu of the row', async () => {
        const user = userEvent.setup();
        const item = actionItemFixture();
        const { onOpen } = renderTable([item]);

        await user.click(
            within(row('item-1')).getByRole('button', { name: 'More actions' }),
        );
        await user.click(
            screen.getByRole('menuitem', { name: 'Edit action item' }),
        );

        expect(onOpen).toHaveBeenCalledWith(item);
    });

    it('asks the page to delete from the "…" menu of the row', async () => {
        const user = userEvent.setup();
        const item = actionItemFixture();
        const { ctx } = renderTable([item]);

        await user.click(
            within(row('item-1')).getByRole('button', { name: 'More actions' }),
        );
        await user.click(
            screen.getByRole('menuitem', { name: 'Delete action item' }),
        );

        expect(ctx.onDelete).toHaveBeenCalledWith(item);
    });

    it('puts the rows of a group under a header that folds, with their count', () => {
        renderWithProviders(
            <ActionItemMutationsContext value={actionItemMutationsFixture()}>
                <ActionItemsTable
                    groups={[
                        {
                            key: 'atlas',
                            label: 'Atlas',
                            items: [
                                actionItemFixture({ id: 'a' }),
                                actionItemFixture({ id: 'b' }),
                            ],
                        },
                        {
                            key: 'mobile',
                            label: 'Mobile',
                            items: [actionItemFixture({ id: 'c' })],
                        },
                    ]}
                    context={context()}
                    onOpen={vi.fn()}
                />
            </ActionItemMutationsContext>,
        );

        const headers = Array.from(
            document.querySelectorAll('[data-slot="action-group"]'),
        ).map((header) => header.textContent);

        expect(headers).toEqual(['Atlas2 action items', 'Mobile1 action item']);

        const fold = screen.getByRole('button', { name: 'Atlas' });

        expect(fold.getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(fold);

        expect(fold.getAttribute('aria-expanded')).toBe('false');
        expect(document.getElementById('action-item-a')).toBeNull();
        expect(document.getElementById('action-item-c')).not.toBeNull();

        fireEvent.click(fold);

        expect(document.getElementById('action-item-a')).not.toBeNull();
    });

    it('reads a finished sprint on its group row, which still folds', () => {
        renderTable([], {
            groups: [
                {
                    key: 'sprint-s41',
                    label: 'Sprint 41',
                    sprint: {
                        id: 's41',
                        number: 41,
                        startsOn: '2026-09-08',
                        endsOn: '2026-09-21',
                        teamId: 'team-1',
                        state: 'finished',
                        itemIds: ['a'],
                    },
                    items: [
                        actionItemFixture({
                            id: 'a',
                            status: 'open',
                            isOverdue: true,
                        }),
                    ],
                },
            ],
        });

        const header = document.querySelector('[data-slot="action-group"]');

        expect(header?.textContent).toContain('Sprint 41');
        expect(screen.getByText('Finished sprint')).toBeTruthy();
        expect(screen.getByText('1 carried over')).toBeTruthy();
        expect(screen.getByText('1 overdue')).toBeTruthy();

        const fold = screen.getByRole('button', { name: 'Sprint 41' });

        fireEvent.click(fold);

        expect(fold.getAttribute('aria-expanded')).toBe('false');
        expect(document.getElementById('action-item-a')).toBeNull();
    });

    it('says that a group counts the rows of this page when there are several', () => {
        renderTable([], {
            groups: [
                {
                    key: 'atlas',
                    label: 'Atlas',
                    items: [actionItemFixture()],
                },
            ],
            paged: true,
        });

        expect(
            document.querySelector('[data-slot="action-group"]')?.textContent,
        ).toBe('Atlas1 action item · on this page');
    });

    it('shows what the page gives it when it has no row', () => {
        renderTable([], { empty: <p>No open action items.</p> });

        expect(
            document.querySelector('[data-slot="table-empty"]')?.textContent,
        ).toBe('No open action items.');
    });

    it('shows skeleton rows while a filter loads', () => {
        renderTable([actionItemFixture()], { loading: true });

        expect(
            document.querySelectorAll('[data-slot="table-loading-row"]').length,
        ).toBeGreaterThan(0);
        expect(document.getElementById('action-item-item-1')).toBeNull();
    });

    it('fills the first column from the selection slot', () => {
        renderTable([actionItemFixture()], {
            selectionCell: (item) => <span data-testid={`pick-${item.id}`} />,
        });

        expect(row('item-1').querySelector('td')?.firstElementChild).toBe(
            screen.getByTestId('pick-item-1'),
        );
    });

    it('marks a selected row', () => {
        renderTable(
            [actionItemFixture({ id: 'a' }), actionItemFixture({ id: 'b' })],
            { isSelected: (item) => item.id === 'a' },
        );

        expect(row('a').dataset.selected).toBe('true');
        expect(row('a').dataset.state).toBe('selected');
        expect(row('b').dataset.selected).toBeUndefined();
    });

    it('gives a group row the box of its group', () => {
        renderTable([], {
            groups: [
                {
                    key: 'team-1',
                    label: 'Atlas',
                    items: [actionItemFixture()],
                },
            ],
            selectionGroup: (group) => (
                <span data-testid={`pick-group-${group.key}`} />
            ),
        });

        const groupRow = document.querySelector('[data-slot="action-group"]');

        expect(groupRow?.querySelector('td')?.firstElementChild).toBe(
            screen.getByTestId('pick-group-team-1'),
        );
    });
});
