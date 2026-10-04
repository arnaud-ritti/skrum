import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionItemsPage } from '@/components/action-items/action-items-page';
import type { ActionItemsPageProps } from '@/components/action-items/action-items-page';
import { actionItemFixture } from '@/test/action-items';
import { renderWithProviders } from '@/test/render';

type Listener = (payload: unknown) => void;

const realtime = vi.hoisted(() => ({
    channels: new Map<string, Map<string, (payload: unknown) => void>>(),
    subscribed: new Map<string, () => void>(),
}));
const inertia = vi.hoisted(() => ({ get: vi.fn(), reload: vi.fn() }));
const retroRequest = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const screenWidth = vi.hoisted(() => ({ wide: true }));

vi.mock('@laravel/echo-react', () => ({
    echoIsConfigured: () => true,
    echo: () => ({
        socketId: () => undefined,
        connector: {
            onConnectionChange: () => () => {},
            connectionStatus: () => 'connected',
        },
        private: (name: string) => {
            const listeners = new Map<string, Listener>();

            realtime.channels.set(name, listeners);

            const channel = {
                subscribed: (callback: () => void) => {
                    realtime.subscribed.set(name, callback);

                    return channel;
                },
                listen: (event: string, listener: Listener) => {
                    listeners.set(event, listener);

                    return channel;
                },
            };

            return channel;
        },
        leave: () => {},
    }),
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({
            props: {
                translations: {},
                locale: 'en',
                currentTeam: { id: 'team-1', name: 'Atlas', membersCount: 2 },
            },
        }),
        Link: ({
            href,
            children,
            preserveScroll: _preserveScroll,
            ...props
        }: {
            href: string;
            children: React.ReactNode;
            preserveScroll?: boolean;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
        router: { get: inertia.get, reload: inertia.reload },
    };
});

const first = actionItemFixture({ id: 'item-1' });
const second = actionItemFixture({
    id: 'item-2',
    content: 'Write the runbook',
    assignee: {
        kind: 'member',
        id: 'user-2',
        name: 'Inès Benali',
        avatarUrl: '/avatars/ines.svg',
        isTeamMember: true,
    },
});

const atlas = {
    id: 'team-1',
    name: 'Atlas',
    members: [
        { id: 'user-1', name: 'Alice Martin', avatarUrl: '/avatars/a.svg' },
        { id: 'user-2', name: 'Inès Benali', avatarUrl: '/avatars/i.svg' },
    ],
};

const noFilters = {
    status: ['todo', 'doing'],
    priority: [],
    due: null,
    source: null,
} satisfies Partial<ActionItemsPageProps['filters']>;

function pageProps(
    overrides: Partial<ActionItemsPageProps> = {},
): ActionItemsPageProps {
    return {
        workspace: { id: 'ws-1', name: 'Nordlys', slug: 'nordlys' },
        filters: { ...noFilters, assignee: null, team: 'team-1', item: null },
        items: {
            data: [first, second],
            currentPage: 1,
            lastPage: 1,
            total: 2,
            prevPageUrl: null,
            nextPageUrl: null,
        },
        focusedItem: null,
        filterTeams: [atlas],
        counts: { open: 2, overdue: 0, completed: 5, mine: 1, rituals: 1 },
        creatableTeams: [atlas],
        assignees: [
            { id: 'user-1', name: 'Alice Martin' },
            { id: 'user-2', name: 'Inès Benali' },
        ],
        realtimeTeamIds: ['team-1'],
        exportSources: {},
        viewer: {
            userId: 'user-1',
            isWorkspaceManager: false,
            facilitatedRetroIds: [],
            reviewTeamIds: [],
        },
        ...overrides,
    };
}

function Harness(props: ActionItemsPageProps & { startCreating?: boolean }) {
    const { startCreating = false, ...page } = props;
    const [creating, setCreating] = useState(startCreating);

    return (
        <ActionItemsPage
            {...page}
            creating={creating}
            onCreatingChange={setCreating}
        />
    );
}

function renderPage(
    overrides: Partial<ActionItemsPageProps> = {},
    startCreating = false,
) {
    return renderWithProviders(
        <Harness {...pageProps(overrides)} startCreating={startCreating} />,
    );
}

function emit(event: string, payload: unknown): void {
    act(() =>
        realtime.channels.get('team-action-items.team-1')?.get(event)?.(
            payload,
        ),
    );
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
    screenWidth.wide = true;
    window.matchMedia = (query: string): MediaQueryList => ({
        matches: screenWidth.wide && query.includes('min-width: 1280px'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    });
    Element.prototype.scrollIntoView = () => {};
    window.localStorage.clear();
    window.history.replaceState({}, '', '/w/nordlys/action-items?team=team-1');
    realtime.channels.clear();
    realtime.subscribed.clear();
    inertia.get.mockReset();
    inertia.reload.mockReset();
    retroRequest.mockReset();
    retroRequest.mockResolvedValue({ comments: [] });
    toast.error.mockReset();
    toast.success.mockReset();
});

afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.history.replaceState({}, '', '/');
});

describe('ActionItemsPage', () => {
    it('carries the one realtime state of the page', () => {
        renderPage();

        const marked = document.querySelectorAll('[data-realtime]');

        expect(marked).toHaveLength(1);
        expect(marked[0].getAttribute('data-realtime')).toBe('connecting');

        act(() => realtime.subscribed.get('team-action-items.team-1')?.());

        expect(marked[0].getAttribute('data-realtime')).toBe('connected');
    });

    it('shows the counters, the filters and the rows in a table', () => {
        renderPage();

        expect(
            screen.getByText('2 open · 0 overdue · from 1 ritual'),
        ).toBeTruthy();
        expect(screen.getByRole('toolbar', { name: 'Filters' })).toBeTruthy();
        expect(
            document.querySelectorAll('tr[id^="action-item-"]'),
        ).toHaveLength(2);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('lays out the six facets and offers Reset once a priority is set', () => {
        const { unmount } = renderPage();
        const toolbar = screen.getByRole('toolbar', { name: 'Filters' });

        expect(
            within(toolbar)
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
        expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();

        unmount();
        renderPage({
            filters: {
                ...noFilters,
                priority: ['high'],
                assignee: null,
                team: 'team-1',
                item: null,
            },
        });

        expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
    });

    it('has no subtitle: the counters are the only line under the title', () => {
        renderPage();

        expect(
            screen.queryByText('Follow-ups of every team you can see'),
        ).toBeNull();
    });

    it('opens the details of a row in a side sheet', async () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Write the runbook' }),
        );

        const sheet = await screen.findByRole('dialog', {
            name: 'Write the runbook',
        });

        expect(sheet.getAttribute('data-slot')).toBe('action-sheet');
        await waitFor(() =>
            expect(sheet.textContent).toContain('No comments yet.'),
        );
    });

    it('opens the item of a deep link when the page loads', async () => {
        renderPage({
            filters: {
                ...noFilters,
                assignee: null,
                team: 'team-1',
                item: 'item-2',
            },
        });

        expect(
            await screen.findByRole('dialog', { name: 'Write the runbook' }),
        ).toBeTruthy();
    });

    it('pins a linked item that the filters leave out, and opens it', async () => {
        const linked = actionItemFixture({
            id: 'item-9',
            content: 'Archive the old board',
            status: 'completed',
            completedAt: '2026-09-29T10:00:00Z',
        });

        renderPage({
            filters: {
                ...noFilters,
                assignee: null,
                team: 'team-1',
                item: 'item-9',
            },
            focusedItem: linked,
        });

        const section = document.querySelector<HTMLElement>(
            '[data-slot="linked-action-item"]',
        );

        expect(section?.textContent).toContain('Linked action item');
        expect(section?.querySelector('#action-item-item-9')).not.toBeNull();
        expect(
            document.querySelectorAll('tr[id^="action-item-"]'),
        ).toHaveLength(3);
        expect(
            await screen.findByRole('dialog', {
                name: 'Archive the old board',
            }),
        ).toBeTruthy();
    });

    it('groups the rows on the page and remembers the choice', () => {
        renderPage({
            filters: { ...noFilters, assignee: null, team: null, item: null },
        });

        fireEvent.click(screen.getByRole('radio', { name: 'Assignee' }));

        const headers = Array.from(
            document.querySelectorAll('[data-slot="action-group"]'),
        ).map((header) => header.textContent);

        expect(headers).toEqual([
            'Unassigned1 action item',
            'Inès Benali1 action item',
        ]);
        expect(
            JSON.parse(
                window.localStorage.getItem('skrum.actionItemFilters.ws-1') ??
                    '{}',
            ).group,
        ).toBe('assignee');

        fireEvent.click(screen.getByRole('radio', { name: 'None' }));

        expect(
            document.querySelectorAll('[data-slot="action-group"]'),
        ).toHaveLength(0);
    });

    it('asks before deleting; Cancel keeps the item', async () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Quarantine the flaky tests' }),
        );

        const sheet = await screen.findByRole('dialog', {
            name: 'Quarantine the flaky tests',
        });

        fireEvent.click(
            within(sheet).getByRole('button', { name: 'Delete action item' }),
        );

        const confirm = await screen.findByRole('alertdialog', {
            name: 'Delete this action item?',
        });

        fireEvent.click(
            within(confirm).getByRole('button', { name: 'Cancel' }),
        );

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
        expect(
            retroRequest.mock.calls.some(
                ([route]) => route.method === 'delete',
            ),
        ).toBe(false);
        expect(document.getElementById('action-item-item-1')).not.toBeNull();
    });

    it('deletes on confirmation: the row leaves and the sheet closes', async () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Quarantine the flaky tests' }),
        );

        const sheet = await screen.findByRole('dialog', {
            name: 'Quarantine the flaky tests',
        });

        fireEvent.click(
            within(sheet).getByRole('button', { name: 'Delete action item' }),
        );

        const confirm = await screen.findByRole('alertdialog');

        retroRequest.mockResolvedValue(null);
        fireEvent.click(
            within(confirm).getByRole('button', { name: 'Delete' }),
        );

        await waitFor(() =>
            expect(document.getElementById('action-item-item-1')).toBeNull(),
        );
        expect(
            retroRequest.mock.calls.some(
                ([route]) =>
                    route.method === 'delete' && route.url.includes('item-1'),
            ),
        ).toBe(true);
        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', {
                    name: 'Quarantine the flaky tests',
                }),
            ).toBeNull(),
        );
    });

    it('tells an open sheet that its item was deleted in another browser', async () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Write the runbook' }),
        );

        const sheet = await screen.findByRole('dialog', {
            name: 'Write the runbook',
        });

        emit('.team-action-item.deleted', { actionItemId: 'item-2' });

        expect(sheet.textContent).toContain('This action item was deleted.');
    });

    it('shows a change of another browser in the row and in the open sheet', async () => {
        renderPage();

        fireEvent.click(
            screen.getByRole('button', { name: 'Write the runbook' }),
        );
        await screen.findByRole('dialog', { name: 'Write the runbook' });

        emit('.team-action-item.saved', {
            actionItem: { ...second, content: 'Write the on-call runbook' },
        });

        expect(
            screen.getByRole('dialog', { name: 'Write the on-call runbook' }),
        ).toBeTruthy();
        expect(
            document.getElementById('action-item-item-2')?.textContent,
        ).toContain('Write the on-call runbook');
    });

    it('says that nothing is open, or that nothing matches the filters', () => {
        const none = {
            data: [],
            currentPage: 1,
            lastPage: 1,
            total: 0,
            prevPageUrl: null,
            nextPageUrl: null,
        };
        const { unmount } = renderPage({
            items: none,
            filters: { ...noFilters, assignee: null, team: null, item: null },
        });

        expect(screen.getByText('No open action items.')).toBeTruthy();

        unmount();

        const team = renderPage({ items: none });

        expect(screen.getByText('No open action items.')).toBeTruthy();
        expect(screen.queryByText('Nothing matches these filters.')).toBeNull();

        team.unmount();
        renderPage({
            items: none,
            filters: {
                ...noFilters,
                assignee: 'me',
                team: 'team-1',
                item: null,
            },
        });

        expect(screen.getByText('Nothing matches these filters.')).toBeTruthy();
    });

    it('pages with Previous and Next and says which page it is', () => {
        renderPage({
            items: {
                data: [first, second],
                currentPage: 1,
                lastPage: 2,
                total: 51,
                prevPageUrl: null,
                nextPageUrl: '/w/nordlys/action-items?page=2',
            },
        });

        const nav = screen.getByRole('navigation', { name: 'Pagination' });

        expect(screen.getByText('Page 1 of 2')).toBeTruthy();
        expect(
            within(nav)
                .getByRole('link', { name: 'Next' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/action-items?page=2');
        expect(
            within(nav)
                .getByRole('link', { name: 'Previous' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
    });

    it('lists the items without a table below the width of the table', () => {
        screenWidth.wide = false;

        renderPage();

        expect(document.querySelector('table')).toBeNull();
        expect(
            document.querySelectorAll(
                '[data-slot="action-item"][id^="action-item-"]',
            ),
        ).toHaveLength(2);
    });

    it('creates an action item for the team of the filter', async () => {
        const created = actionItemFixture({ id: 'item-3', content: 'New one' });

        renderPage({}, true);

        const dialog = await screen.findByRole('dialog', {
            name: 'New action item',
        });

        expect(
            within(dialog).getByRole('combobox', { name: 'Team' }).textContent,
        ).toContain('Atlas');

        retroRequest.mockResolvedValue({ actionItem: created });
        fireEvent.change(within(dialog).getByLabelText('Add an action item…'), {
            target: { value: 'New one' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

        await waitFor(() =>
            expect(
                retroRequest.mock.calls.some(
                    ([route, payload]) =>
                        route.method === 'post' &&
                        payload?.team_id === 'team-1' &&
                        payload?.content === 'New one',
                ),
            ).toBe(true),
        );
        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', { name: 'New action item' }),
            ).toBeNull(),
        );
        expect(inertia.reload).toHaveBeenCalled();
    });

    describe('selection', () => {
        function box(name: string): HTMLElement {
            return screen.getByRole('checkbox', { name });
        }

        it('selects rows on the table and shows the bulk bar', () => {
            renderPage();

            fireEvent.click(box('Select Quarantine the flaky tests'));

            expect(
                screen.getByRole('toolbar', { name: 'Bulk actions' })
                    .textContent,
            ).toContain('1 selected');
            expect(
                document
                    .getElementById('action-item-item-1')
                    ?.getAttribute('data-selected'),
            ).toBe('true');

            fireEvent.click(box('Select all on this page'));

            expect(box('Clear selection').getAttribute('aria-checked')).toBe(
                'true',
            );
        });

        it('enters selection mode below the table with Select, and Finish selecting clears it', () => {
            screenWidth.wide = false;
            renderPage();

            expect(
                screen.queryByRole('checkbox', {
                    name: 'Select Quarantine the flaky tests',
                }),
            ).toBeNull();

            fireEvent.click(screen.getByRole('button', { name: 'Select' }));
            fireEvent.click(box('Select Quarantine the flaky tests'));

            const toolbar = screen.getByRole('toolbar', {
                name: 'Bulk actions',
            });

            expect(toolbar.getAttribute('data-layout')).toBe('docked');
            expect(toolbar.textContent).toContain('1 selected');

            fireEvent.click(
                screen.getByRole('button', { name: 'Finish selecting' }),
            );

            expect(
                screen.queryByRole('toolbar', { name: 'Bulk actions' }),
            ).toBeNull();
            expect(
                screen.queryByRole('checkbox', {
                    name: 'Select Quarantine the flaky tests',
                }),
            ).toBeNull();
        });

        it('enters selection mode with the item of a long press selected', () => {
            vi.useFakeTimers();
            screenWidth.wide = false;
            renderPage();

            const item = document.getElementById('action-item-item-1')!;

            fireEvent.pointerDown(item, { clientX: 5, clientY: 5 });
            act(() => {
                vi.advanceTimersByTime(500);
            });
            vi.useRealTimers();

            expect(
                box('Select Quarantine the flaky tests').getAttribute(
                    'data-state',
                ),
            ).toBe('checked');
            expect(
                screen.getByRole('button', { name: 'Finish selecting' }),
            ).toBeTruthy();
        });

        it('offers no Select button beside the table', () => {
            renderPage();

            expect(screen.queryByRole('button', { name: 'Select' })).toBeNull();
        });

        it('clears the selection with Escape', () => {
            renderPage();

            fireEvent.click(box('Select Quarantine the flaky tests'));
            fireEvent.keyDown(document.body, { key: 'Escape' });

            expect(
                screen.queryByRole('toolbar', { name: 'Bulk actions' }),
            ).toBeNull();
        });

        it('clears the selection when the filters change', () => {
            const { rerender } = renderPage();

            fireEvent.click(box('Select Quarantine the flaky tests'));
            rerender(
                <Harness
                    {...pageProps({
                        filters: {
                            ...noFilters,
                            priority: ['high'],
                            assignee: null,
                            team: 'team-1',
                            item: null,
                        },
                    })}
                />,
            );

            expect(
                screen.queryByRole('toolbar', { name: 'Bulk actions' }),
            ).toBeNull();
        });

        it('keeps all matching over a page change, and reloads after a change', async () => {
            const paged = {
                data: [first, second],
                currentPage: 1,
                lastPage: 3,
                total: 137,
                prevPageUrl: null,
                nextPageUrl: '/w/nordlys/action-items?page=2',
            };
            const { rerender } = renderPage({ items: paged });

            fireEvent.click(box('Select all on this page'));
            fireEvent.click(
                screen.getByRole('button', { name: 'Select all 137 matching' }),
            );
            rerender(
                <Harness
                    {...pageProps({
                        items: {
                            ...paged,
                            data: [actionItemFixture({ id: 'item-9' })],
                            currentPage: 2,
                        },
                    })}
                />,
            );

            expect(
                screen.getByRole('toolbar', { name: 'Bulk actions' })
                    .textContent,
            ).toContain('All 137 matching selected');

            retroRequest.mockResolvedValue({
                actionItems: [],
                changedCount: 137,
                refused: [],
            });
            fireEvent.click(
                within(
                    screen.getByRole('toolbar', { name: 'Bulk actions' }),
                ).getByRole('button', { name: 'Delete' }),
            );
            retroRequest.mockResolvedValue({ deleted: [], refused: [] });
            fireEvent.click(
                within(
                    await screen.findByRole('alertdialog', {
                        name: 'Delete 137 action items?',
                    }),
                ).getByRole('button', { name: 'Delete' }),
            );

            await waitFor(() =>
                expect(inertia.reload).toHaveBeenCalledWith({
                    only: ['items', 'counts'],
                }),
            );
        });
    });
});
