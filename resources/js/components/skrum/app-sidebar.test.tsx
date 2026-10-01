import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    AppSidebar,
    type AppSidebarProps,
} from '@/components/skrum/app-sidebar';
import { MobileTabBar } from '@/components/skrum/mobile-tab-bar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

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
    return render(
        <TooltipProvider>
            <SidebarProvider>
                <AppSidebar {...base} {...props} />
            </SidebarProvider>
        </TooltipProvider>,
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
    });

    it('caps the visible overdue count and keeps the full count for screen readers', () => {
        renderSidebar({ overdueActions: 120 });

        expect(screen.getByText('99+')).toBeTruthy();
        expect(screen.getByText('120 overdue')).toBeTruthy();
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
            name: 'Settings',
        });

        expect(
            within(settingsNav).getByRole('link', { name: 'Team settings' }),
        ).toBeTruthy();
    });

    it('renders no settings landmark when it has no links', () => {
        renderSidebar({ links: { teams: '/w1' } });

        expect(
            screen.queryByRole('navigation', { name: 'Settings' }),
        ).toBeNull();
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
        render(<MobileTabBar links={base.links} onMore={() => {}} />);

        expect(
            screen.getAllByRole('link').map((link) => link.textContent?.trim()),
        ).toEqual(['Home', 'Sessions', 'Actions', 'Mood']);
        expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    });
});
