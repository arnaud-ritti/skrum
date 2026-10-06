import { act, fireEvent, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actionItems,
    CommandMenu,
    gotoItems,
    openCommandMenuEvent,
    openKeyboardShortcutsEvent,
    recentDate,
    recentItems,
    resultItems,
} from '@/components/workspaces/command-menu';
import type { RecentSession } from '@/hooks/use-recent-sessions';
import { renderWithProviders } from '@/test/render';

const visit = vi.hoisted(() => vi.fn());

const page = vi.hoisted(() => ({
    props: {
        translations: {} as Record<string, string>,
        locale: 'en',
        currentWorkspace: {
            id: 'w1',
            name: 'Nordlys',
            slug: 'nordlys',
            role: 'owner',
            canManageMembers: true,
        } as {
            id: string;
            name: string;
            slug: string;
            role: string;
            canManageMembers: boolean;
        } | null,
        currentTeam: { id: 't1', name: 'Atlas', membersCount: 8 } as {
            id: string;
            name: string;
            membersCount: number;
            viewerRole?: string;
            settingsSections?: Record<string, boolean> | null;
        } | null,
        teams: [] as { id: string; name: string }[],
    },
}));

const appearance = vi.hoisted(() => ({
    resolved: 'light' as 'light' | 'dark',
    update: vi.fn(),
}));

const search = vi.hoisted(() => ({
    results: [] as unknown[],
    term: '',
    loading: false,
    failed: false,
}));

const recent = vi.hoisted(() => ({
    sessions: [] as unknown[],
    loading: false,
    failed: false,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { visit: (...args: unknown[]) => visit(...args) },
    usePage: () => page,
}));

vi.mock('@/hooks/use-appearance', () => ({
    useAppearance: () => ({
        appearance: appearance.resolved,
        resolvedAppearance: appearance.resolved,
        updateAppearance: appearance.update,
    }),
}));

vi.mock('@/hooks/use-global-search', () => ({
    useGlobalSearch: () => search,
}));

vi.mock('@/hooks/use-recent-sessions', () => ({
    useRecentSessions: () => recent,
}));

const t = (key: string, replacements: Record<string, string | number> = {}) =>
    Object.entries(replacements).reduce(
        (line, [name, value]) => line.replace(`:${name}`, String(value)),
        key,
    );

const Now = new Date('2026-10-02T12:00:00Z').getTime();

function session(overrides: Partial<RecentSession> = {}): RecentSession {
    return {
        kind: 'retro',
        id: 'r1',
        title: 'Sprint 42',
        team: { id: 't1', name: 'Atlas' },
        url: '/retros/r1',
        updatedAt: '2026-09-30T12:00:00Z',
        live: false,
        ...overrides,
    };
}

beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;

    if (!('scrollIntoView' in Element.prototype)) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', {
            value: () => {},
            configurable: true,
            writable: true,
        });
    }
});

beforeEach(() => {
    visit.mockReset();
    search.results = [];
    search.term = '';
    search.failed = false;
    recent.sessions = [];
    page.props.currentWorkspace = {
        id: 'w1',
        name: 'Nordlys',
        slug: 'nordlys',
        role: 'owner',
        canManageMembers: true,
    };
    page.props.currentTeam = { id: 't1', name: 'Atlas', membersCount: 8 };
    page.props.teams = [];
    appearance.resolved = 'light';
    appearance.update.mockReset();
});

describe('resultItems', () => {
    it('maps a server result to a palette item that always passes the local filter', () => {
        const [item] = resultItems(
            [
                {
                    kind: 'poker',
                    id: 'g1',
                    title: 'Sprint 12',
                    team: { id: 't1', name: 'Atlas' },
                    url: '/poker/g1',
                },
            ],
            'kraken',
        );

        expect(item).toMatchObject({
            id: 'poker-g1',
            group: 'results',
            label: 'Sprint 12',
            meta: 'Atlas',
            keywords: ['kraken'],
        });

        item.onSelect();
        expect(visit).toHaveBeenCalledWith('/poker/g1');
    });

    it('gives two results of different kinds with the same id different item ids', () => {
        const items = resultItems(
            [
                {
                    kind: 'retro',
                    id: 'x',
                    title: 'A',
                    team: { id: 't', name: 'T' },
                    url: '/a',
                },
                {
                    kind: 'action',
                    id: 'x',
                    title: 'B',
                    team: { id: 't', name: 'T' },
                    url: '/b',
                },
            ],
            'ab',
        );

        expect(new Set(items.map((item) => item.id)).size).toBe(2);
    });

    it('shows the retro of a card in place of its team', () => {
        const [item] = resultItems(
            [
                {
                    kind: 'card',
                    id: 'c1',
                    title: 'Deploys are slow',
                    team: { id: 't1', name: 'Atlas' },
                    url: '/retros/r1',
                    context: 'Sprint 42',
                },
            ],
            'deploy',
        );

        expect(item.meta).toBe('Sprint 42');
    });
});

describe('recentDate', () => {
    it('is relative under seven days and a short date after', () => {
        expect(recentDate('2026-09-30T12:00:00Z', 'en', Now)).toBe(
            '2 days ago',
        );
        expect(recentDate('2026-10-02T09:00:00Z', 'en', Now)).toBe('3 hr. ago');
        expect(recentDate('2026-09-16T12:00:00Z', 'en', Now)).toBe('Sep 16');
        expect(recentDate('2026-09-16T12:00:00Z', 'fr', Now)).toBe('16 sept.');
        expect(recentDate('nonsense', 'en', Now)).toBe('');
    });
});

describe('recentItems', () => {
    it('names the team of a retro and the kind of the others, with the date', () => {
        const items = recentItems(
            [
                session(),
                session({
                    kind: 'whiteboard',
                    id: 'b1',
                    title: 'Workshop',
                    url: '/whiteboards/b1',
                    updatedAt: '2026-09-09T12:00:00Z',
                }),
            ],
            t,
            'en',
            Now,
        );

        expect(items.map((item) => [item.label, item.meta])).toEqual([
            ['Sprint 42', 'Atlas · 2 days ago'],
            ['Workshop', 'Whiteboard · Sep 9'],
        ]);
        expect(items.every((item) => item.group === 'recent')).toBe(true);

        items[1].onSelect();
        expect(visit).toHaveBeenCalledWith('/whiteboards/b1');
    });

    it('puts a live session first, with the badge "Live"', () => {
        const items = recentItems(
            [session(), session({ id: 'r2', title: 'Sprint 43', live: true })],
            t,
            'en',
            Now,
        );

        expect(items.map((item) => [item.label, item.badge])).toEqual([
            ['Sprint 43', 'Live'],
            ['Sprint 42', undefined],
        ]);
    });
});

describe('actionItems', () => {
    it('opens the "New session" dialog of the current team on the type asked', () => {
        const items = actionItems({ teamUrl: '/w/nordlys/teams/t1' }, t);

        expect(items.map((item) => item.label)).toEqual([
            'New retrospective',
            'New poker session',
            'New whiteboard',
            'New survey',
            'New icebreaker',
            'Join a session with a code',
            'Show keyboard shortcuts',
        ]);

        for (const [index, type] of [
            'retro',
            'poker',
            'whiteboard',
            'survey',
            'icebreaker',
        ].entries()) {
            items[index].onSelect();
            expect(visit).toHaveBeenLastCalledWith(
                `/w/nordlys/teams/t1?new=${type}`,
            );
        }
    });

    it('leads to the page that takes a code, with or without a team', () => {
        const join = actionItems({}, t).find((item) => item.id === 'join');

        join?.onSelect();
        expect(visit).toHaveBeenLastCalledWith('/join');
    });

    it('offers the other theme and flips to it', () => {
        const onToggle = vi.fn();
        const inLight = actionItems(
            { theme: { resolved: 'light', onToggle } },
            t,
        ).find((item) => item.id === 'theme');
        const inDark = actionItems(
            { theme: { resolved: 'dark', onToggle } },
            t,
        ).find((item) => item.id === 'theme');

        expect(inLight?.label).toBe('Switch to dark theme');
        expect(inDark?.label).toBe('Switch to light theme');
        expect(inLight?.keywords).toContain('Theme');

        inLight?.onSelect();
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('offers the invitation to those who may invite, and leads to the members page', () => {
        const items = actionItems(
            {
                teamUrl: '/w/nordlys/teams/t1',
                invite: { workspace: 'Nordlys', url: '/w/nordlys/members' },
            },
            t,
        );
        const invite = items.find((item) => item.id === 'invite');

        expect(invite?.label).toBe('Invite to Nordlys');

        invite?.onSelect();
        expect(visit).toHaveBeenLastCalledWith('/w/nordlys/members');
    });

    it('keeps the code and the keyboard shortcuts without a current team, and announces the shortcuts on the window', () => {
        const items = actionItems({}, t);
        const heard = vi.fn();
        window.addEventListener(openKeyboardShortcutsEvent, heard);

        expect(items.map((item) => item.id)).toEqual(['join', 'shortcuts']);

        items[1].onSelect();
        expect(heard).toHaveBeenCalledTimes(1);

        window.removeEventListener(openKeyboardShortcutsEvent, heard);
    });
});

describe('gotoItems', () => {
    it('has one item per link of the sidebar and invents none', () => {
        const items = gotoItems(
            {
                dashboard: '/t1',
                actions: { url: '/w/nordlys/actions', method: 'get' },
            },
            t,
        );

        expect(items.map((item) => item.label)).toEqual([
            'Home',
            'Action items',
            'Profile',
            'Security',
            'Notification settings',
        ]);
        expect(items[1].shortcut).toEqual(['G', 'A']);

        items[1].onSelect();
        expect(visit).toHaveBeenLastCalledWith('/w/nordlys/actions');
    });

    it('offers each page of the sidebar once when it is given no other page', () => {
        const items = gotoItems(
            {
                dashboard: '/t1',
                sessions: '/t1/sessions',
                actions: '/actions?team=t1',
                insights: '/t1/insights',
                members: '/t1/members',
                settings: '/t1/settings',
                templates: '/templates',
                teams: '/w1',
                admin: '/admin',
            },
            t,
        );

        expect(
            items
                .filter((item) => !item.keywords?.includes('Settings'))
                .map((item) => item.label),
        ).toEqual([
            'Home',
            'Sessions',
            'Action items',
            'Insights',
            'Members',
            'Settings',
            'Templates',
            'All teams',
            'Administration',
        ]);

        items.find((item) => item.id === 'goto-insights')?.onSelect();
        expect(visit).toHaveBeenLastCalledWith('/t1/insights');
    });

    it('offers Activity in the palette', () => {
        const items = gotoItems(
            {
                members: '/t1/members',
                activity: '/t1/activity',
                settings: '/t1/settings',
            },
            t,
        );

        expect(
            items
                .filter((item) => !item.keywords?.includes('Settings'))
                .map((item) => item.label),
        ).toEqual(['Members', 'Activity', 'Settings']);

        items.find((item) => item.id === 'goto-activity')?.onSelect();
        expect(visit).toHaveBeenLastCalledWith('/t1/activity');
    });

    it('shows the instance settings with their sequence to an admin', () => {
        const admin = gotoItems({ admin: '/admin' }, t).find(
            (item) => item.id === 'goto-admin',
        );

        expect(admin?.shortcut).toEqual(['G', 'S']);
    });

    it('shows the sequence of each page that has one', () => {
        const items = gotoItems(
            {
                dashboard: '/t1',
                sessions: '/t1/sessions',
                actions: '/actions',
                insights: '/t1/insights',
                members: '/t1/members',
                activity: '/t1/activity',
                settings: '/t1/settings',
                templates: '/templates',
                teams: '/w1',
            },
            t,
        );

        expect(
            Object.fromEntries(
                items
                    .filter((item) => item.shortcut !== undefined)
                    .map((item) => [item.label, item.shortcut?.join(' ')]),
            ),
        ).toEqual({
            Home: 'G H',
            Sessions: 'G E',
            'Action items': 'G A',
            Insights: 'G I',
            Members: 'G M',
            Templates: 'G T',
        });
    });

    it('lists the other settings pages after Settings and the other tabs after Insights, each marked and found by that word', () => {
        const icon = (() => null) as never;
        const items = gotoItems(
            { insights: '/t1/insights', settings: '/t1/settings' },
            t,
            {
                settingsPages: [
                    {
                        id: 'sprints',
                        label: 'Sprints',
                        icon,
                        href: '/t1/sprints',
                    },
                ],
                insightsPages: [
                    { id: 'enps', label: 'eNPS', icon, href: '/t1/enps' },
                ],
            },
        );

        expect(
            items.slice(0, 4).map((item) => [item.label, item.meta]),
        ).toEqual([
            ['Insights', undefined],
            ['eNPS', 'Insights'],
            ['Settings', undefined],
            ['Sprints', 'Settings'],
        ]);
        expect(items[1].keywords).toEqual(['Insights']);

        items[3].onSelect();
        expect(visit).toHaveBeenLastCalledWith('/t1/sprints');
    });

    it('lists no other page under an entry the viewer does not have', () => {
        const icon = (() => null) as never;
        const items = gotoItems({ dashboard: '/t1' }, t, {
            settingsPages: [
                { id: 'sprints', label: 'Sprints', icon, href: '/t1/sprints' },
            ],
        });

        expect(items.map((item) => item.label)).not.toContain('Sprints');
    });

    it('lists the other teams, marked "Team" and found by that word', () => {
        const icon = (() => null) as never;
        const items = gotoItems({}, t, {
            teams: [{ id: 't2', label: 'Borealis', icon, href: '/t2' }],
        });
        const team = items.find((item) => item.id === 'goto-team-t2');

        expect([team?.label, team?.meta, team?.keywords]).toEqual([
            'Borealis',
            'Team',
            ['Team'],
        ]);

        team?.onSelect();
        expect(visit).toHaveBeenLastCalledWith('/t2');
    });
});

describe('CommandMenu', () => {
    function headings(): (string | null)[] {
        return Array.from(
            document.querySelectorAll('[cmdk-group-heading]'),
        ).map((heading) => heading.textContent);
    }

    function open(): void {
        fireEvent.click(
            document.querySelector(
                '[data-test="command-menu-button"]',
            ) as HTMLElement,
        );
    }

    it('shows "Actions", "Recent sessions" then "Go to" with an empty query', () => {
        recent.sessions = [session()];
        renderWithProviders(<CommandMenu links={{ dashboard: '/t1' }} />);

        open();

        expect(headings()).toEqual(['Actions', 'Recent sessions', 'Go to']);
        expect(screen.queryByText('Invite to Nordlys')).toBeNull();

        fireEvent.click(screen.getByText('Show 4 more'));

        expect(screen.getByText('Invite to Nordlys')).toBeTruthy();
    });

    it('puts "Results" between the recent sessions and "Go to" with a query', () => {
        recent.sessions = [session()];
        search.term = 'sprint';
        search.results = [
            {
                kind: 'poker',
                id: 'g1',
                title: 'Estimations',
                team: { id: 't1', name: 'Atlas' },
                url: '/poker/g1',
            },
        ];
        renderWithProviders(
            <CommandMenu
                links={{ dashboard: '/t1', sessions: '/t1/sessions' }}
            />,
        );

        open();
        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'sprint' },
        });

        expect(headings()).toEqual(['Recent sessions', 'Results']);

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 's' },
        });

        expect(headings()).toEqual([
            'Actions',
            'Recent sessions',
            'Results',
            'Go to',
        ]);
    });

    it('does not offer the invitation to a member, nor a new session without a team', () => {
        page.props.currentWorkspace = {
            id: 'w1',
            name: 'Nordlys',
            slug: 'nordlys',
            role: 'member',
            canManageMembers: false,
        };
        page.props.currentTeam = null;
        renderWithProviders(<CommandMenu links={{}} />);

        open();

        expect(screen.queryByText('Invite to Nordlys')).toBeNull();
        expect(screen.queryByText('New retrospective')).toBeNull();
        expect(screen.getByText('Show keyboard shortcuts')).toBeTruthy();
    });

    it('offers the invitation as the server allows it, whatever the role', () => {
        page.props.currentWorkspace = {
            id: 'w1',
            name: 'Nordlys',
            slug: 'nordlys',
            role: 'owner',
            canManageMembers: false,
        };
        renderWithProviders(<CommandMenu links={{}} />);

        open();

        expect(screen.queryByText('Invite to Nordlys')).toBeNull();
    });

    it('offers no new session to an observer of the team', () => {
        page.props.currentTeam = {
            id: 't1',
            name: 'Atlas',
            membersCount: 8,
            viewerRole: 'observer',
        };
        renderWithProviders(<CommandMenu links={{}} />);

        open();

        expect(screen.queryByText('New retrospective')).toBeNull();
        expect(screen.queryByText('New poker session')).toBeNull();
    });

    it('says that the search is unavailable when nothing else matches', () => {
        search.failed = true;
        renderWithProviders(<CommandMenu links={{}} />);

        open();
        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'zzzz' },
        });

        expect(
            screen.getByText('Search is unavailable. Try again in a moment.'),
        ).toBeTruthy();
    });

    it('opens on the event of the window', () => {
        renderWithProviders(<CommandMenu links={{}} />);

        act(() => {
            window.dispatchEvent(new Event(openCommandMenuEvent));
        });

        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('goes to a page of the sidebar on G then its key, and nowhere for a page the viewer does not have', () => {
        renderWithProviders(
            <CommandMenu
                links={{
                    dashboard: '/t1',
                    sessions: '/t1/sessions',
                    insights: '/t1/insights',
                    members: '/t1/members',
                }}
            />,
        );

        for (const [key, url] of [
            ['h', '/t1'],
            ['e', '/t1/sessions'],
            ['i', '/t1/insights'],
            ['m', '/t1/members'],
        ]) {
            fireEvent.keyDown(document.body, { key: 'g' });
            fireEvent.keyDown(document.body, { key });
            expect(visit).toHaveBeenLastCalledWith(url);
        }

        visit.mockReset();
        fireEvent.keyDown(document.body, { key: 'g' });
        fireEvent.keyDown(document.body, { key: 't' });
        expect(visit).not.toHaveBeenCalled();
    });

    it('flips the theme from the palette', () => {
        appearance.resolved = 'dark';
        renderWithProviders(<CommandMenu links={{}} />);

        open();
        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'appearance' },
        });
        fireEvent.click(screen.getByText('Switch to light theme'));

        expect(appearance.update).toHaveBeenCalledWith('light');
    });

    it('lists the other team of the viewer, the settings pages open to them after the first and the other Insights tabs', () => {
        page.props.currentTeam = {
            id: 't1',
            name: 'Atlas',
            membersCount: 8,
            settingsSections: {
                general: false,
                sprints: true,
                retros: true,
                health: true,
                integrations: false,
                data: false,
            },
        };
        page.props.teams = [
            { id: 't1', name: 'Atlas' },
            { id: 't2', name: 'Borealis' },
        ];
        renderWithProviders(
            <CommandMenu
                links={{ insights: '/t1/insights', settings: '/t1/sprints' }}
            />,
        );

        open();
        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'settings' },
        });

        expect(screen.getByText('Retrospectives')).toBeTruthy();
        expect(screen.getAllByText('Health check')).toHaveLength(1);
        expect(screen.queryByText('Sprints')).toBeNull();
        expect(screen.queryByText('Data & export')).toBeNull();

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'insights' },
        });

        expect(screen.getByText('eNPS')).toBeTruthy();
        expect(screen.getByText('Estimates')).toBeTruthy();
        expect(screen.getByText('Games')).toBeTruthy();
        expect(screen.queryByText('Mood & ROTI')).toBeNull();

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'team' },
        });

        expect(screen.getByText('Borealis')).toBeTruthy();
        expect(screen.queryByText('Atlas')).toBeNull();
    });

    it('goes to the action items on G then A, and to the instance settings on G then S', () => {
        renderWithProviders(
            <CommandMenu
                links={{ actions: '/w/nordlys/actions', admin: '/admin' }}
            />,
        );

        fireEvent.keyDown(document.body, { key: 'g' });
        fireEvent.keyDown(document.body, { key: 'a' });
        expect(visit).toHaveBeenLastCalledWith('/w/nordlys/actions');

        fireEvent.keyDown(document.body, { key: 'g' });
        fireEvent.keyDown(document.body, { key: 's' });
        expect(visit).toHaveBeenLastCalledWith('/admin');
    });

    it('shows the three key hints and the number of results in a polite live region', () => {
        renderWithProviders(<CommandMenu links={{}} />);

        open();

        const count = screen.getByText('12 results');

        expect(count.getAttribute('aria-live')).toBe('polite');
        expect(screen.getByText('navigate')).toBeTruthy();
        expect(screen.getByText('open')).toBeTruthy();
        expect(screen.getByText('close')).toBeTruthy();
    });
});
