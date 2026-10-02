import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppLayout from '@/layouts/skrum/app-layout';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, sidebarOpen: true } }),
}));

vi.mock('@/hooks/use-sidebar-model', () => ({
    useSidebarModel: () => ({
        team: { id: 't1', name: 'Atlas', initials: 'AT', membersCount: 8 },
        teams: [],
        workspace: { id: 'w1', name: 'Nordlys' },
        workspaces: [],
        newWorkspaceHref: '/workspaces/create',
        homeHref: '/dashboard',
        links: { dashboard: '/t1' },
    }),
}));

vi.mock('@/components/nav-user', () => ({ NavUser: () => null }));

vi.mock('@/components/action-items/notifications-menu', () => ({
    NotificationsMenu: () => <button type="button">Notifications</button>,
}));

describe('AppLayout', () => {
    it('renders the actions at the end of the topbar, before the bell', () => {
        renderWithProviders(
            <AppLayout
                breadcrumbs={[{ title: 'Atlas', href: '/t1' }]}
                actions={<button type="button">New action item</button>}
            >
                <p>content</p>
            </AppLayout>,
        );

        const buttons = Array.from(
            screen.getByRole('banner').querySelectorAll('button'),
        ).map((button) => button.textContent);

        expect(buttons.slice(-2)).toEqual(['New action item', 'Notifications']);
        expect(screen.getByRole('main').textContent).toBe('content');
    });

    it('shows the search and the bell alone without actions', () => {
        renderWithProviders(
            <AppLayout>
                <p>content</p>
            </AppLayout>,
        );

        const banner = screen.getByRole('banner');

        expect(
            banner.querySelectorAll('[data-test^="command-menu-button"]'),
        ).toHaveLength(2);
        expect(banner.querySelectorAll('button')).toHaveLength(4);
        expect(
            Array.from(banner.querySelectorAll('button')).at(-1)?.textContent,
        ).toBe('Notifications');
    });
});
