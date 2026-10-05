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
        sessions: '/t1#sessions',
        actions: '/actions',
        mood: '/t1#mood',
        games: '/t1/games',
        members: '/t1#members',
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
    it('lists the team and workspace entries in the order of the design system', () => {
        renderSidebar();

        const labels = screen
            .getAllByRole('link')
            .map((link) => link.textContent?.trim())
            .filter((label) => label && label !== 'Skrüm');

        expect(labels).toEqual([
            'Dashboard',
            'Sessions',
            'Actions',
            'Mood & ROTI',
            'Games',
            'Members',
            'Templates',
            'All teams',
        ]);
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
                .getByRole('link', { name: 'Dashboard' })
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

        expect(
            screen.queryByRole('link', { name: 'Team settings' }),
        ).toBeNull();
        expect(
            screen.queryByRole('link', { name: 'Administration' }),
        ).toBeNull();
        expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
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

    it('puts the settings link in its own labelled navigation landmark', () => {
        renderSidebar({ links: { ...base.links, settings: '/t1/settings' } });

        const settingsNav = screen.getByRole('navigation', {
            name: 'Team and administration',
        });

        expect(
            within(settingsNav).getByRole('link', { name: 'Team settings' }),
        ).toBeTruthy();
    });

    it('renders no settings landmark when it has no links', () => {
        renderSidebar({ links: { teams: '/w1' } });

        expect(
            screen.queryByRole('navigation', {
                name: 'Team and administration',
            }),
        ).toBeNull();
    });

    it('does not name any landmark "Settings", which belongs to the settings sub-navigation', () => {
        renderSidebar({
            links: { ...base.links, settings: '/t1/settings', admin: '/admin' },
        });

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
            <MobileTabBar links={base.links} onMore={() => {}} />,
        );

        expect(
            screen.getAllByRole('link').map((link) => link.textContent?.trim()),
        ).toEqual(['Home', 'Sessions', 'Actions', 'Mood']);
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
