import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionItemSelectCell } from '@/components/action-items/action-item-select-cell';
import { ActionItemsBulkBar } from '@/components/action-items/action-items-bulk-bar';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import type { RunMutation } from '@/components/action-items/use-action-item-mutations';
import { useActionItemSelection } from '@/components/action-items/use-action-item-selection';
import { RetroRequestError } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import {
    actionItemEndpointsFixture,
    actionItemFixture,
    actionItemViewerFixture,
} from '@/test/action-items';
import { renderWithProviders } from '@/test/render';
import type { ExportSource } from '@/types/integrations';

const retroRequest = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const atlas = {
    id: 'team-1',
    name: 'Atlas',
    members: [
        { id: 'user-1', name: 'Alice Martin', avatarUrl: '/a.svg' },
        { id: 'user-2', name: 'Inès Benali', avatarUrl: '/i.svg' },
    ],
};
const borealis = {
    id: 'team-2',
    name: 'Borealis',
    members: [
        { id: 'user-1', name: 'Alice Martin', avatarUrl: '/a.svg' },
        { id: 'user-3', name: 'Tom Weber', avatarUrl: '/t.svg' },
    ],
};

const rows = [
    actionItemFixture({ id: 'a', content: 'Fix the build' }),
    actionItemFixture({ id: 'b', content: 'Write the runbook' }),
    actionItemFixture({
        id: 'c',
        content: 'Rotate the keys',
        teamId: 'team-2',
    }),
];

const filters: ActionItemFilters = {
    status: ['todo', 'doing'],
    priority: [],
    due: null,
    source: null,
    assignee: null,
    team: null,
    item: null,
};

const run: RunMutation = async (request) => {
    try {
        return await request;
    } catch {
        return undefined;
    }
};

const handlers = {
    run,
    onSaved: vi.fn(),
    onRemoved: vi.fn(),
};

const jira: ExportSource = {
    source: 'jira',
    label: 'Jira',
    integrationId: 'integration-1',
};

function Harness({
    total = 3,
    reloadedTotal = total,
    items = rows,
    shownFilters = filters,
    sources = {},
    layout = 'floating',
}: {
    total?: number;
    reloadedTotal?: number;
    items?: ActionItem[];
    shownFilters?: ActionItemFilters;
    sources?: Record<string, ExportSource[]>;
    layout?: 'floating' | 'docked';
}) {
    const [count, setCount] = useState(total);
    const selection = useActionItemSelection({
        rows: items,
        viewer: actionItemViewerFixture(),
        total: count,
        filtersKey: 'f',
        pageKey: 'p',
    });

    return (
        <>
            {items.map((row) => (
                <ActionItemSelectCell
                    key={row.id}
                    item={row}
                    selection={selection}
                />
            ))}
            <ActionItemsBulkBar
                workspace="nordlys"
                locale="en"
                items={items}
                selection={selection}
                filters={shownFilters}
                teams={[atlas, borealis]}
                viewer={actionItemViewerFixture()}
                endpoints={actionItemEndpointsFixture()}
                scope={{ workspace: 'nordlys', canManagePeople: false }}
                sourcesOf={(teamId) => sources[teamId] ?? []}
                layout={layout}
                {...handlers}
                onReload={() => setCount(reloadedTotal)}
            />
        </>
    );
}

async function select(...titles: string[]): Promise<void> {
    for (const title of titles) {
        await userEvent.click(
            screen.getByRole('checkbox', { name: `Select ${title}` }),
        );
    }
}

function bar(): HTMLElement {
    return screen.getByRole('toolbar', { name: 'Bulk actions' });
}

async function choose(menu: string, item: string): Promise<void> {
    await userEvent.click(within(bar()).getByRole('button', { name: menu }));
    await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}

beforeEach(() => {
    Element.prototype.scrollIntoView = () => {};
    retroRequest.mockReset();
    vi.clearAllMocks();
});

describe('ActionItemsBulkBar', () => {
    it('shows the count while rows are selected and clears them', async () => {
        renderWithProviders(<Harness />);

        expect(screen.queryByRole('toolbar')).toBeNull();

        await select('Fix the build', 'Write the runbook', 'Rotate the keys');

        expect(within(bar()).getByRole('status').textContent).toBe(
            '3 selected',
        );

        await userEvent.click(
            within(bar()).getByRole('button', { name: 'Clear selection' }),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('changes the status of the selected rows', async () => {
        retroRequest.mockResolvedValue({
            actionItems: [rows[0]],
            changedCount: 1,
            refused: [],
        });
        renderWithProviders(<Harness />);

        await select('Fix the build');
        await choose('Status', 'In progress');

        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'post' }),
            { ids: ['a'], changes: { status: 'doing' } },
            { timeoutMs: 60_000 },
        );
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                '1 action item updated.',
            ),
        );
        expect(handlers.onSaved).toHaveBeenCalledWith(rows[0]);
        expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('keeps the rows ticked while the request was running', async () => {
        let answer: (value: unknown) => void = () => undefined;
        retroRequest.mockReturnValue(
            new Promise((resolve) => {
                answer = resolve;
            }),
        );
        renderWithProviders(<Harness />);

        await select('Fix the build');
        await choose('Status', 'In progress');
        await select('Rotate the keys');

        answer({ actionItems: [rows[0]], changedCount: 1, refused: [] });

        await waitFor(() =>
            expect(within(bar()).getByRole('status').textContent).toBe(
                '1 selected',
            ),
        );
        expect(
            screen
                .getByRole('checkbox', { name: 'Select Rotate the keys' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('lists only the members common to the teams of the selection', async () => {
        renderWithProviders(<Harness />);

        await select('Fix the build', 'Rotate the keys');
        await userEvent.click(
            within(bar()).getByRole('button', { name: 'Assign' }),
        );

        const options = await screen.findAllByRole('option');

        expect(options).toHaveLength(2);
        expect(options[0].textContent).toBe('Unassigned');
        expect(options[1].textContent).toContain('Alice Martin');
    });

    it('reports the refused items and keeps them selected', async () => {
        retroRequest.mockResolvedValue({
            actionItems: [rows[0]],
            changedCount: 1,
            refused: [
                {
                    id: 'b',
                    title: 'Write the runbook',
                    message: 'You cannot change this action item.',
                },
                { id: 'gone', title: null, message: 'This item was deleted.' },
            ],
        });
        renderWithProviders(<Harness />);

        await select('Fix the build', 'Write the runbook');
        await choose('Priority', 'High');

        await waitFor(() =>
            expect(toast.warning).toHaveBeenCalledWith(
                '1 updated, 2 not changed.',
                expect.objectContaining({
                    action: expect.objectContaining({ label: 'Details' }),
                }),
            ),
        );

        expect(within(bar()).getByRole('status').textContent).toBe(
            '1 selected',
        );
        expect(
            screen
                .getByRole('checkbox', { name: 'Select Write the runbook' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        act(() => {
            toast.warning.mock.calls[0][1].action.onClick();
        });

        const details = await screen.findByRole('dialog');

        expect(within(details).getByText('Write the runbook')).toBeTruthy();
        expect(
            within(details).getByText('You cannot change this action item.'),
        ).toBeTruthy();
        expect(
            within(details).getByText('This item was deleted.'),
        ).toBeTruthy();
    });

    it('asks before deleting, and Cancel sends nothing', async () => {
        renderWithProviders(<Harness />);

        await select('Fix the build', 'Write the runbook');
        await userEvent.click(
            within(bar()).getByRole('button', { name: 'Delete' }),
        );

        const confirm = await screen.findByRole('alertdialog', {
            name: 'Delete 2 action items?',
        });

        await userEvent.click(
            within(confirm).getByRole('button', { name: 'Cancel' }),
        );

        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('deletes the selected rows once confirmed', async () => {
        retroRequest.mockResolvedValue({ deleted: ['a', 'b'], refused: [] });
        renderWithProviders(<Harness />);

        await select('Fix the build', 'Write the runbook');
        await userEvent.click(
            within(bar()).getByRole('button', { name: 'Delete' }),
        );
        await userEvent.click(
            within(await screen.findByRole('alertdialog')).getByRole('button', {
                name: 'Delete',
            }),
        );

        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'post' }),
            { ids: ['a', 'b'] },
            { timeoutMs: 60_000 },
        );
        expect(handlers.onRemoved).toHaveBeenCalledWith('a');
        expect(handlers.onRemoved).toHaveBeenCalledWith('b');
        expect(toast.success).toHaveBeenCalledWith('2 action items deleted.');
    });

    describe('all matching', () => {
        async function selectPage(): Promise<void> {
            await select(
                'Fix the build',
                'Write the runbook',
                'Rotate the keys',
            );
        }

        it('offers every matching item once the page is selected', async () => {
            renderWithProviders(<Harness total={137} />);

            await selectPage();
            await userEvent.click(
                within(bar()).getByRole('button', {
                    name: 'Select all 137 matching',
                }),
            );

            expect(within(bar()).getByRole('status').textContent).toBe(
                'All 137 matching selected',
            );
        });

        it('refuses above the cap', async () => {
            renderWithProviders(<Harness total={501} />);

            await selectPage();

            const offer = within(bar()).getByRole('button', {
                name: 'Select all 501 matching',
            });

            expect(offer.getAttribute('aria-disabled')).toBe('true');

            await userEvent.hover(offer);

            expect(
                await screen.findByRole('tooltip', {
                    name: 'Up to 500 at once. Narrow the filters.',
                }),
            ).toBeTruthy();
        });

        it('asks before a change, and Cancel sends nothing', async () => {
            renderWithProviders(<Harness total={137} />);

            await selectPage();
            await userEvent.click(
                within(bar()).getByRole('button', {
                    name: 'Select all 137 matching',
                }),
            );
            await choose('Priority', 'High');

            const confirm = await screen.findByRole('alertdialog', {
                name: 'Apply to 137 action items?',
            });

            await userEvent.click(
                within(confirm).getByRole('button', { name: 'Cancel' }),
            );

            expect(retroRequest).not.toHaveBeenCalled();
        });

        it('applies the change to the filters and reloads', async () => {
            retroRequest.mockResolvedValue({
                actionItems: [],
                changedCount: 137,
                refused: [],
            });
            renderWithProviders(<Harness total={137} />);

            await selectPage();
            await userEvent.click(
                within(bar()).getByRole('button', {
                    name: 'Select all 137 matching',
                }),
            );
            await choose('Priority', 'High');
            await userEvent.click(
                within(await screen.findByRole('alertdialog')).getByRole(
                    'button',
                    { name: 'Apply' },
                ),
            );

            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'post' }),
                { filters: {}, count: 137, changes: { priority: 'high' } },
                { timeoutMs: 60_000 },
            );
            await waitFor(() =>
                expect(toast.success).toHaveBeenCalledWith(
                    '137 action items updated.',
                ),
            );
            expect(screen.queryByRole('toolbar')).toBeNull();
        });

        it('keeps the dialog open when the list changed, then sends the new count', async () => {
            retroRequest.mockRejectedValueOnce(
                new RetroRequestError(422, 'The list changed.', {
                    count: ['The list changed: 140 action items match now.'],
                }),
            );
            retroRequest.mockResolvedValueOnce({
                actionItems: [],
                changedCount: 140,
                refused: [],
            });
            renderWithProviders(<Harness total={137} reloadedTotal={140} />);

            await selectPage();
            await userEvent.click(
                within(bar()).getByRole('button', {
                    name: 'Select all 137 matching',
                }),
            );
            await choose('Priority', 'High');
            await userEvent.click(
                within(await screen.findByRole('alertdialog')).getByRole(
                    'button',
                    { name: 'Apply' },
                ),
            );

            const confirm = await screen.findByRole('alertdialog', {
                name: 'Apply to 140 action items?',
            });

            expect(
                within(confirm).getByText(
                    'The list changed: 140 action items match now.',
                ),
            ).toBeTruthy();

            await userEvent.click(
                within(confirm).getByRole('button', { name: 'Apply' }),
            );

            expect(retroRequest).toHaveBeenLastCalledWith(
                expect.objectContaining({ method: 'post' }),
                { filters: {}, count: 140, changes: { priority: 'high' } },
                { timeoutMs: 60_000 },
            );
        });

        it('leaves the mode when a row is unticked', async () => {
            renderWithProviders(<Harness total={137} />);

            await selectPage();
            await userEvent.click(
                within(bar()).getByRole('button', {
                    name: 'Select all 137 matching',
                }),
            );
            await select('Fix the build');

            expect(within(bar()).getByRole('status').textContent).toBe(
                '2 selected',
            );
        });
    });

    describe('sync to a tracker', () => {
        const linked = actionItemFixture({
            id: 'd',
            content: 'Close the incident',
            externalLinks: [
                {
                    id: 'link-1',
                    source: 'jira',
                    key: 'OPS-1',
                    url: 'https://jira.test/OPS-1',
                    state: 'open',
                    statusName: 'To Do',
                    syncState: 'synced',
                    syncError: null,
                    lastSyncedAt: null,
                } as NonNullable<ActionItem['externalLinks']>[number],
            ],
        });
        const items = [...rows, linked];
        const targets = {
            projects: [{ id: '10', key: 'OPS', name: 'Operations' }],
            issueTypes: [{ id: '3', name: 'Task' }],
            defaults: { projectId: '10', issueTypeId: '3' },
        };

        function exportAnswer(item: ActionItem, key: string) {
            return {
                actionItem: {
                    ...item,
                    externalLinks: [
                        { ...linked.externalLinks![0], id: `l-${key}`, key },
                    ],
                },
                warnings: [],
            };
        }

        function answer(exportOne: (url: string) => Promise<unknown>): void {
            retroRequest.mockImplementation(
                (route: { url: string; method: string }) =>
                    route.method === 'get'
                        ? Promise.resolve(targets)
                        : exportOne(route.url),
            );
        }

        async function openSync(): Promise<HTMLElement> {
            await userEvent.click(
                within(bar()).getByRole('button', { name: 'Sync to Jira' }),
            );

            const dialog = await screen.findByRole('dialog', {
                name: 'Sync to Jira',
            });

            await waitFor(() =>
                expect(
                    within(dialog)
                        .getByRole('button', { name: 'Export 2 items' })
                        .hasAttribute('disabled'),
                ).toBe(false),
            );

            return dialog;
        }

        it('is hidden for a selection of two teams', async () => {
            renderWithProviders(
                <Harness
                    items={items}
                    sources={{ 'team-1': [jira], 'team-2': [jira] }}
                />,
            );

            await select('Fix the build', 'Rotate the keys');

            expect(
                within(bar()).queryByRole('button', { name: 'Sync to Jira' }),
            ).toBeNull();
        });

        it('carries the mark of its tracker', async () => {
            renderWithProviders(
                <Harness items={items} sources={{ 'team-1': [jira] }} />,
            );

            await select('Fix the build', 'Write the runbook');

            expect(
                within(bar())
                    .getByRole('button', { name: 'Sync to Jira' })
                    .querySelector('[data-provider-mark="jira"]'),
            ).not.toBeNull();
        });

        it('is hidden for a team without a tracker', async () => {
            renderWithProviders(
                <Harness items={items} sources={{ 'team-1': [jira] }} />,
            );

            await select('Rotate the keys');

            expect(
                within(bar()).queryByRole('button', { name: 'Sync to Jira' }),
            ).toBeNull();
        });

        it('is disabled in all matching mode, with its reason', async () => {
            renderWithProviders(
                <Harness
                    total={137}
                    shownFilters={{ ...filters, team: 'team-1' }}
                    sources={{ 'team-1': [jira] }}
                />,
            );

            await select(
                'Fix the build',
                'Write the runbook',
                'Rotate the keys',
            );
            await userEvent.click(
                within(bar()).getByRole('button', {
                    name: 'Select all 137 matching',
                }),
            );

            const sync = within(bar()).getByRole('button', {
                name: 'Sync to Jira',
            });

            expect(sync.hasAttribute('disabled')).toBe(true);

            await userEvent.hover(sync.parentElement!);

            expect(
                await screen.findByRole('tooltip', {
                    name: 'Select rows on this page to sync them.',
                }),
            ).toBeTruthy();
        });

        it('exports the unlinked items one after the other and skips the linked one', async () => {
            const finishes: ((value: unknown) => void)[] = [];

            answer(
                () =>
                    new Promise((resolve) => {
                        finishes.push(resolve);
                    }),
            );
            renderWithProviders(
                <Harness items={items} sources={{ 'team-1': [jira] }} />,
            );

            await select(
                'Fix the build',
                'Write the runbook',
                'Close the incident',
            );

            const dialog = await openSync();

            await userEvent.click(
                within(dialog).getByRole('button', { name: 'Export 2 items' }),
            );

            expect(
                await within(bar()).findByText('Exporting 1 of 2…'),
            ).toBeTruthy();
            expect(within(bar()).getByRole('progressbar')).toBeTruthy();

            await act(async () => finishes[0](exportAnswer(rows[0], 'OPS-2')));

            expect(
                await within(bar()).findByText('Exporting 2 of 2…'),
            ).toBeTruthy();

            await act(async () => finishes[1](exportAnswer(rows[1], 'OPS-3')));

            const posts = retroRequest.mock.calls
                .filter(([route]) => route.method === 'post')
                .map(([route]) => route.url);

            expect(posts).toEqual(['/items/a/exports', '/items/b/exports']);
            await waitFor(() =>
                expect(toast.success).toHaveBeenCalledWith(
                    '2 exported, 1 already linked.',
                ),
            );
            expect(handlers.onSaved).toHaveBeenCalledTimes(2);
        });

        it('stops on a reconnect answer and lists it in the details', async () => {
            answer(() =>
                Promise.reject(
                    new RetroRequestError(
                        409,
                        'Reconnecte Jira dans les réglages de l’équipe.',
                        {},
                        {
                            message:
                                'Reconnecte Jira dans les réglages de l’équipe.',
                            reason: 'reconnect_required',
                        },
                    ),
                ),
            );
            renderWithProviders(
                <Harness items={items} sources={{ 'team-1': [jira] }} />,
            );

            await select('Fix the build', 'Write the runbook');
            await userEvent.click(
                within(await openSync()).getByRole('button', {
                    name: 'Export 2 items',
                }),
            );

            await waitFor(() =>
                expect(toast.warning).toHaveBeenCalledWith(
                    '0 exported, 0 already linked, 2 failed.',
                    expect.anything(),
                ),
            );
            expect(
                retroRequest.mock.calls.filter(
                    ([route]) => route.method === 'post',
                ),
            ).toHaveLength(1);

            const [, options] = toast.warning.mock.calls[0];

            act(() => {
                options.action.onClick();
            });

            const details = await screen.findByRole('dialog', {
                name: 'Action items not exported',
            });

            expect(within(details).getByText('Fix the build')).toBeTruthy();
            expect(
                within(details).getByText(
                    'Reconnecte Jira dans les réglages de l’équipe.',
                ),
            ).toBeTruthy();
        });

        it('says that an item without an answer in time may be exported already', async () => {
            answer(() => Promise.reject(new RetroRequestError(0, 'timeout')));
            renderWithProviders(
                <Harness items={items} sources={{ 'team-1': [jira] }} />,
            );

            await select('Fix the build', 'Write the runbook');
            await userEvent.click(
                within(await openSync()).getByRole('button', {
                    name: 'Export 2 items',
                }),
            );

            await waitFor(() => expect(toast.warning).toHaveBeenCalled());

            const [, options] = toast.warning.mock.calls[0];

            act(() => {
                options.action.onClick();
            });

            expect(
                within(
                    await screen.findByRole('dialog', {
                        name: 'Action items not exported',
                    }),
                ).getAllByText(
                    'The server did not answer in time: the item may be exported already. Reload the page before you try again.',
                ),
            ).toHaveLength(2);
        });

        it('ends after the current item when stopped', async () => {
            const finishes: ((value: unknown) => void)[] = [];

            answer(
                () =>
                    new Promise((resolve) => {
                        finishes.push(resolve);
                    }),
            );
            renderWithProviders(
                <Harness items={items} sources={{ 'team-1': [jira] }} />,
            );

            await select('Fix the build', 'Write the runbook');
            await userEvent.click(
                within(await openSync()).getByRole('button', {
                    name: 'Export 2 items',
                }),
            );
            await userEvent.click(
                await within(bar()).findByRole('button', { name: 'Stop' }),
            );
            await act(async () => finishes[0](exportAnswer(rows[0], 'OPS-2')));

            await waitFor(() =>
                expect(toast.warning).toHaveBeenCalledWith(
                    '1 exported, 0 already linked, 1 failed.',
                    expect.anything(),
                ),
            );
            expect(finishes).toHaveLength(1);

            const [, options] = toast.warning.mock.calls[0];

            act(() => {
                options.action.onClick();
            });

            const details = await screen.findByRole('dialog', {
                name: 'Action items not exported',
            });

            expect(within(details).getByText('Write the runbook')).toBeTruthy();
            expect(
                within(details).getByText('Not sent: the export was stopped.'),
            ).toBeTruthy();
        });
    });

    describe('docked below 80rem', () => {
        it('shows Status, Assign and Due date, and the rest under More actions', async () => {
            renderWithProviders(
                <Harness layout="docked" sources={{ 'team-1': [jira] }} />,
            );

            await select('Fix the build');

            const docked = bar();

            expect(docked.getAttribute('data-layout')).toBe('docked');
            expect(
                within(docked)
                    .getAllByRole('button')
                    .map(
                        (button) =>
                            button.textContent ||
                            button.getAttribute('aria-label'),
                    ),
            ).toEqual([
                'Status',
                'Assign',
                'Due date',
                'More actions',
                'Clear selection',
            ]);

            await userEvent.click(
                within(docked).getByRole('button', { name: 'More actions' }),
            );

            const menu = await screen.findByRole('menu');

            expect(
                within(menu)
                    .getAllByRole('menuitem')
                    .map((item) => item.textContent),
            ).toEqual(['Priority', 'Sync to Jira', 'Delete']);
        });

        it('selects every matching item from More actions in one step', async () => {
            renderWithProviders(<Harness layout="docked" total={137} />);

            await select('Fix the build');
            await userEvent.click(
                within(bar()).getByRole('button', { name: 'More actions' }),
            );
            await userEvent.click(
                await screen.findByRole('menuitem', {
                    name: 'Select all 137 matching',
                }),
            );

            expect(within(bar()).getByRole('status').textContent).toBe(
                'All 137 matching selected',
            );
        });

        it('refuses every matching item above the cap', async () => {
            renderWithProviders(<Harness layout="docked" total={501} />);

            await select('Fix the build');
            await userEvent.click(
                within(bar()).getByRole('button', { name: 'More actions' }),
            );

            expect(
                (
                    await screen.findByRole('menuitem', {
                        name: 'Select all 501 matching',
                    })
                ).getAttribute('aria-disabled'),
            ).toBe('true');
        });
    });
});
