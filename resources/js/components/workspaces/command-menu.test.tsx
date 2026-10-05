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
        } | null,
    },
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
            'Show keyboard shortcuts',
        ]);

        items[0].onSelect();
        expect(visit).toHaveBeenLastCalledWith('/w/nordlys/teams/t1?new=retro');

        items[1].onSelect();
        expect(visit).toHaveBeenLastCalledWith('/w/nordlys/teams/t1?new=poker');
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

    it('keeps only the keyboard shortcuts without a current team, and announces them on the window', () => {
        const items = actionItems({}, t);
        const heard = vi.fn();
        window.addEventListener(openKeyboardShortcutsEvent, heard);

        expect(items.map((item) => item.id)).toEqual(['shortcuts']);

        items[0].onSelect();
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

    it('offers Insights and neither Mood & ROTI nor Games in the palette', () => {
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

    it('shows the instance settings with their sequence to an admin', () => {
        const admin = gotoItems({ admin: '/admin' }, t).find(
            (item) => item.id === 'goto-admin',
        );

        expect(admin?.shortcut).toEqual(['G', 'S']);
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

        const count = screen.getByText('7 results');

        expect(count.getAttribute('aria-live')).toBe('polite');
        expect(screen.getByText('navigate')).toBeTruthy();
        expect(screen.getByText('open')).toBeTruthy();
        expect(screen.getByText('close')).toBeTruthy();
    });
});
