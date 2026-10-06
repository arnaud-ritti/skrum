import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import {
    AppSidebar,
    type AppSidebarProps,
} from '@/components/skrum/app-sidebar';
import { MobileTabBar } from '@/components/skrum/mobile-tab-bar';
import { SidebarProvider } from '@/components/ui/sidebar';

const base: AppSidebarProps = {
    team: { id: 't1', name: 'Atlas', initials: 'AT', membersCount: 8 },
    teams: [{ id: 't1', name: 'Atlas', href: '/t1' }],
    workspace: { id: 'w1', name: 'Nordlys' },
    workspaces: [{ id: 'w1', name: 'Nordlys', href: '/w1' }],
    newWorkspaceHref: '/workspaces/create',
    homeHref: '/dashboard',
    links: {
        dashboard: '/t1',
        sessions: '/t1/sessions',
        actions: '/actions?team=t1',
        insights: '/t1/insights',
        members: '/t1/members',
        activity: '/t1/activity',
        settings: '/t1/settings',
        templates: '/templates',
        teams: '/w1',
    },
};

function renderSidebar(props: Partial<AppSidebarProps> = {}) {
    return renderWithProviders(
        <SidebarProvider>
            <AppSidebar {...base} {...props} />
        </SidebarProvider>,
    );
}

describe('AppSidebar', () => {
    it('lists Activity between Members and Settings', () => {
        const { container } = renderSidebar();
        const team = Array.from(
            container.querySelectorAll('[data-slot="sidebar-group"]'),
        )[1];
        const links = Array.from(team.querySelectorAll('a'));

        expect(links.map((link) => link.textContent?.trim())).toEqual([
            'Members',
            'Activity',
            'Settings',
        ]);
        expect(links[1].getAttribute('href')).toBe('/t1/activity');
    });

    it('lists Home, Sessions, Actions, Insights, then Members, Activity and Settings under Team, then Templates and All teams', () => {
        const { container } = renderSidebar();

        const groups = Array.from(
            container.querySelectorAll('[data-slot="sidebar-group"]'),
        ).map((group) => ({
            label:
                group.querySelector('[data-slot="sidebar-group-label"]')
                    ?.textContent ?? null,
            entries: Array.from(group.querySelectorAll('a')).map((link) =>
                link.textContent?.trim(),
            ),
        }));

        expect(groups).toEqual([
            {
                label: null,
                entries: ['Home', 'Sessions', 'Actions', 'Insights'],
            },
            { label: 'Team', entries: ['Members', 'Activity', 'Settings'] },
            { label: 'Workspace', entries: ['Templates', 'All teams'] },
        ]);
    });

    it('shows a dot and the count on Sessions when a session is live, and nothing when none is', () => {
        const { container, unmount } = renderSidebar({ liveSessions: 2 });
        const badge = container.querySelector('[data-slot="live-badge"]');
        const mark = badge?.querySelector('[data-slot="live-mark"]');

        expect(badge?.textContent).toBe('2');
        expect(badge?.getAttribute('aria-hidden')).toBe('true');
        expect(badge?.className).toContain('rounded-full');
        expect(badge?.className).toContain('bg-skrum-success-soft');
        expect(badge?.className).toContain('text-skrum-success-text');
        expect(badge?.className).toContain('tabular-nums');
        expect(mark?.className).toContain('bg-current');
        expect(
            container.querySelector('[data-slot="live-dot"]'),
        ).not.toBeNull();
        expect(
            screen.getByRole('link', { name: 'Sessions, 2 live' }),
        ).toBeTruthy();

        unmount();

        const idle = renderSidebar({ liveSessions: 0 });

        expect(
            idle.container.querySelector('[data-slot="live-badge"]'),
        ).toBeNull();
        expect(
            idle.container.querySelector('[data-slot="live-dot"]'),
        ).toBeNull();
        expect(screen.getByRole('link', { name: 'Sessions' })).toBeTruthy();
    });

    it('sets New session apart from the switcher', () => {
        renderSidebar({ newSessionHref: '/t1?new=session' });

        expect(
            screen.getByRole('link', { name: 'New session' }).closest('li')
                ?.className,
        ).toContain('mt-3');
    });

    it('shows New session only with a link', () => {
        const { unmount } = renderSidebar({
            newSessionHref: '/t1?new=session',
        });

        expect(
            screen
                .getByRole('link', { name: 'New session' })
                .getAttribute('href'),
        ).toBe('/t1?new=session');

        unmount();
        renderSidebar();

        expect(screen.queryByRole('link', { name: 'New session' })).toBeNull();
    });

    it('lists Actions first under Workspace when the user has no team', () => {
        const { container } = renderSidebar({
            team: null,
            teams: [],
            links: {
                actions: '/actions',
                templates: '/templates',
                teams: '/w1',
            },
        });

        expect(
            Array.from(
                container.querySelectorAll('[data-slot="sidebar-group"] a'),
            ).map((link) => link.textContent?.trim()),
        ).toEqual(['Actions', 'Templates', 'All teams']);
    });

    it('shows the symbol and the wordmark in the brand link', () => {
        const { container } = renderSidebar();

        const brandLink = container.querySelector('a[href="/dashboard"]');

        expect(brandLink?.querySelector('[data-part="symbol"]')).not.toBeNull();
        expect(
            brandLink?.querySelector('[data-part="wordmark"]'),
        ).not.toBeNull();
    });

    it('marks the active entry', () => {
        renderSidebar({ active: 'actions' });

        expect(
            screen
                .getByRole('link', { name: /Actions/ })
                .getAttribute('aria-current'),
        ).toBe('page');
        expect(
            screen
                .getByRole('link', { name: 'Home' })
                .getAttribute('aria-current'),
        ).toBeNull();
    });

    it('shows the overdue badge with an accessible name', () => {
        renderSidebar({ overdueActions: 3 });

        expect(screen.getByText('3 overdue')).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Actions, 3 overdue' }),
        ).toBeTruthy();
    });

    it('names the actions link with the full overdue count above 99', () => {
        renderSidebar({ overdueActions: 120 });

        expect(
            screen.getByRole('link', { name: 'Actions, 120 overdue' }),
        ).toBeTruthy();
    });

    it('words the overdue count in the badge, as the mockup', () => {
        renderSidebar({ overdueActions: 3 });

        expect(screen.getByText('3 overdue').className).not.toContain(
            'sr-only',
        );
    });

    it('words a count above 99 as 99+ and keeps the full count for screen readers', () => {
        renderSidebar({ overdueActions: 120 });

        expect(screen.getByText('99+ overdue')).toBeTruthy();
        expect(screen.getByText('120 overdue').className).toContain('sr-only');
    });

    it('hides the badge when nothing is overdue', () => {
        renderSidebar({ overdueActions: 0 });

        expect(screen.queryByText('0 overdue')).toBeNull();
    });

    it('renders no entry without a link', () => {
        renderSidebar({ links: { teams: '/w1' } });

        expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
        expect(
            screen.queryByRole('link', { name: 'Administration' }),
        ).toBeNull();
        expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
    });

    it('hides the Team group when the user has no team', () => {
        renderSidebar({
            team: null,
            teams: [],
            links: { templates: '/templates', teams: '/w1' },
        });

        expect(screen.queryByText('Team')).toBeNull();
        expect(screen.getByRole('link', { name: 'All teams' })).toBeTruthy();
    });

    it('puts the administration link in its own labelled navigation landmark, above the user card', () => {
        renderSidebar({ links: { ...base.links, admin: '/admin' } });

        const adminNav = screen.getByRole('navigation', {
            name: 'Administration',
        });

        expect(
            within(adminNav).getByRole('link', { name: 'Administration' }),
        ).toBeTruthy();
        expect(
            within(adminNav).queryByRole('link', { name: 'Settings' }),
        ).toBeNull();
        expect(adminNav.closest('[data-slot="sidebar-footer"]')).not.toBeNull();
    });

    it('renders no administration landmark without its link', () => {
        renderSidebar();

        expect(
            screen.queryByRole('navigation', { name: 'Administration' }),
        ).toBeNull();
    });

    it('does not name any landmark "Settings", which belongs to the settings sub-navigation', () => {
        renderSidebar({ links: { ...base.links, admin: '/admin' } });

        expect(
            screen.queryByRole('navigation', { name: 'Settings' }),
        ).toBeNull();
    });

    it('draws a destructive dot on the Actions entry for the collapsed rail', () => {
        const { container } = renderSidebar({ overdueActions: 3 });

        const dot = container.querySelector('[data-slot="overdue-dot"]');

        expect(dot?.className).toContain('bg-destructive');
        expect(
            screen.getByRole('link', { name: 'Actions, 3 overdue' }),
        ).toBeTruthy();
    });

    it('draws no dot when nothing is overdue', () => {
        const { container } = renderSidebar();

        expect(container.querySelector('[data-slot="overdue-dot"]')).toBeNull();
    });

    it('gives the brand link a single accessible name', () => {
        renderSidebar();

        expect(screen.getByRole('link', { name: 'Skrüm' })).toBeTruthy();
        expect(screen.queryByRole('img', { name: 'Skrüm' })).toBeNull();
    });

    it('keeps the Skrüm logo when the brand has no logo', () => {
        const { container } = renderSidebar({
            brand: { name: 'Acme', logoLightUrl: null, logoDarkUrl: null },
        });
        const link = screen.getByRole('link', { name: 'Acme' });

        expect(link.querySelectorAll('svg')).toHaveLength(2);
        expect(container.querySelector('img')).toBeNull();
    });

    it('shows the instance logo as an image in the brand link', () => {
        renderSidebar({
            brand: {
                name: 'Acme',
                logoLightUrl: '/brand/logo-light?v=1',
                logoDarkUrl: null,
            },
        });
        const link = screen.getByRole('link', { name: 'Acme' });
        const logo = within(link).getByRole('img', { name: 'Acme' });

        expect(logo.getAttribute('src')).toBe('/brand/logo-light?v=1');
        expect(logo.className).toContain('h-7');
        expect(logo.className).toContain('dark:bg-card');
        expect(link.querySelector('svg')).toBeNull();
    });

    it('shows the dark logo in the dark theme when the brand has one', () => {
        renderSidebar({
            brand: {
                name: 'Acme',
                logoLightUrl: '/brand/logo-light?v=1',
                logoDarkUrl: '/brand/logo-dark?v=2',
            },
        });
        const [light, dark] = within(
            screen.getByRole('link', { name: 'Acme' }),
        ).getAllByRole('img', { name: 'Acme' });

        expect(light.className).toContain('dark:hidden');
        expect(dark.getAttribute('src')).toBe('/brand/logo-dark?v=2');
        expect(dark.className).toContain('dark:block');
    });

    it('offers New team in the switcher only with a href', async () => {
        const user = userEvent.setup();
        const { unmount } = renderSidebar({ newTeamHref: '/teams/create' });

        await user.click(screen.getByRole('button', { name: /Atlas/ }));

        expect(
            screen
                .getByRole('menuitem', { name: 'New team' })
                .getAttribute('href'),
        ).toBe('/teams/create');

        unmount();
        renderSidebar();
        await user.click(screen.getByRole('button', { name: /Atlas/ }));

        expect(screen.queryByRole('menuitem', { name: 'New team' })).toBeNull();
    });

    it('marks the current team in the switcher', async () => {
        const user = userEvent.setup();

        renderSidebar({
            teams: [
                { id: 't1', name: 'Atlas', href: '/t1' },
                { id: 't2', name: 'Borealis', href: '/t2' },
            ],
        });
        await user.click(screen.getByRole('button', { name: /Atlas/ }));

        expect(
            screen
                .getByRole('menuitem', { name: 'Atlas' })
                .getAttribute('aria-current'),
        ).toBe('true');
        expect(
            screen
                .getByRole('menuitem', { name: 'Borealis' })
                .getAttribute('aria-current'),
        ).toBeNull();
    });

    it('says the team count and the role of each workspace, and marks the current one', async () => {
        const user = userEvent.setup();

        renderSidebar({
            workspaces: [
                {
                    id: 'w1',
                    name: 'Nordlys',
                    href: '/w1',
                    teamsCount: 3,
                    role: 'admin',
                },
                {
                    id: 'w2',
                    name: 'Kestrel Labs',
                    href: '/w2',
                    teamsCount: 1,
                    role: 'member',
                },
            ],
        });
        await user.click(screen.getByRole('button', { name: /Atlas/ }));

        const current = screen.getByRole('menuitem', { name: /Nordlys/ });
        const other = screen.getByRole('menuitem', { name: /Kestrel Labs/ });

        expect(
            current.querySelector('[data-slot="workspace-details"]')
                ?.textContent,
        ).toBe('3 teams · Admin');
        expect(
            other.querySelector('[data-slot="workspace-details"]')?.textContent,
        ).toBe('1 team · Member');
        expect(current.getAttribute('aria-current')).toBe('true');
        expect(other.getAttribute('aria-current')).toBeNull();
        expect(
            other.querySelector('[data-slot="workspace-mark"]')?.textContent,
        ).toBe('K');
    });

    it('shows a workspace without details when the server sends none', async () => {
        const user = userEvent.setup();

        renderSidebar();
        await user.click(screen.getByRole('button', { name: /Atlas/ }));

        expect(
            screen
                .getByRole('menuitem', { name: /Nordlys/ })
                .querySelector('[data-slot="workspace-details"]'),
        ).toBeNull();
    });

    it('renders the user card in the footer when no footer is given', () => {
        renderSidebar({
            user: { name: 'Ada Lovelace', role: 'Admin', avatarUrl: null },
        });

        expect(screen.getByText('Ada Lovelace')).toBeTruthy();
        expect(screen.getByText('Admin')).toBeTruthy();
    });

    it('prefers an explicit footer over the user card', () => {
        renderSidebar({
            footer: <p>Old footer</p>,
            user: { name: 'Ada Lovelace', role: 'Admin' },
        });

        expect(screen.getByText('Old footer')).toBeTruthy();
        expect(screen.queryByText('Ada Lovelace')).toBeNull();
    });

    it('is a labelled navigation landmark', () => {
        renderSidebar();

        expect(
            screen.getByRole('navigation', { name: 'Navigation' }),
        ).toBeTruthy();
    });
});

describe('MobileTabBar', () => {
    it('shows the five tabs', () => {
        renderWithProviders(
            <MobileTabBar
                links={base.links}
                newSessionHref="/t1?new=session"
                onMore={() => {}}
            />,
        );

        expect(
            screen
                .getAllByRole('link')
                .map(
                    (link) =>
                        link.getAttribute('aria-label') ??
                        link.textContent?.trim(),
                ),
        ).toEqual(['Home', 'Sessions', 'New session', 'Actions']);
        expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    });

    it('has its own landmark name', () => {
        renderWithProviders(
            <MobileTabBar links={base.links} onMore={() => {}} />,
        );

        expect(
            screen.getByRole('navigation', { name: 'Tab bar' }),
        ).toBeTruthy();
    });

    it('exposes the open state of the More dialog', () => {
        const { rerender } = renderWithProviders(
            <MobileTabBar links={base.links} onMore={() => {}} />,
        );
        const more = screen.getByRole('button', { name: 'More' });

        expect(more.getAttribute('aria-haspopup')).toBe('dialog');
        expect(more.getAttribute('aria-expanded')).toBe('false');

        rerender(
            <MobileTabBar links={base.links} onMore={() => {}} moreOpen />,
        );

        expect(more.getAttribute('aria-expanded')).toBe('true');
    });
});
