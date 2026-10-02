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

vi.mock('@/components/notification-bell', () => ({
    NotificationBell: () => <button type="button">Notifications</button>,
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

    it('shows the bell alone without actions', () => {
        renderWithProviders(
            <AppLayout>
                <p>content</p>
            </AppLayout>,
        );

        expect(
            screen.getByRole('banner').querySelectorAll('button'),
        ).toHaveLength(2);
    });
});
