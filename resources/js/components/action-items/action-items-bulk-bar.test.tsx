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
import {
    actionItemFixture,
    actionItemViewerFixture,
} from '@/test/action-items';
import { renderWithProviders } from '@/test/render';

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

function Harness({
    total = 3,
    reloadedTotal = total,
}: {
    total?: number;
    reloadedTotal?: number;
}) {
    const [count, setCount] = useState(total);
    const selection = useActionItemSelection({
        rows,
        viewer: actionItemViewerFixture(),
        total: count,
        filtersKey: 'f',
        pageKey: 'p',
    });

    return (
        <>
            {rows.map((row) => (
                <ActionItemSelectCell
                    key={row.id}
                    item={row}
                    selection={selection}
                />
            ))}
            <ActionItemsBulkBar
                workspace="nordlys"
                locale="en"
                items={rows}
                selection={selection}
                filters={filters}
                teams={[atlas, borealis]}
                viewer={actionItemViewerFixture()}
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
});
