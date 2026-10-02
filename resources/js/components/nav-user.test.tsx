import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavUser } from '@/components/nav-user';
import { SidebarProvider } from '@/components/ui/sidebar';
import { renderWithProviders } from '@/test/render';
import type { User } from '@/types';

const page = vi.hoisted(() => ({ user: null as unknown }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: {}, auth: { user: page.user } },
    }),
}));

const user: User = {
    id: '0199a000-0000-7000-8000-000000000001',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    avatarUrl: '/avatars/a.svg',
    email_verified_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

function renderNavUser() {
    return renderWithProviders(
        <SidebarProvider>
            <NavUser />
        </SidebarProvider>,
    );
}

beforeEach(() => {
    page.user = user;
});

describe('NavUser', () => {
    it('renders no user card for a visitor', () => {
        page.user = null;

        renderNavUser();

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows the member on a button that announces a menu', () => {
        renderNavUser();

        const button = screen.getByRole('button', { name: 'Ada Lovelace' });

        expect(button.getAttribute('data-test')).toBe('sidebar-menu-button');
        expect(button.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('opens the account menu with the email and the log out entry', async () => {
        renderNavUser();

        await userEvent.click(
            screen.getByRole('button', { name: 'Ada Lovelace' }),
        );

        expect(screen.getByText('ada@example.com')).toBeTruthy();
        expect(
            screen
                .getByRole('menuitem', { name: 'Log out' })
                .getAttribute('data-test'),
        ).toBe('logout-button');
    });
});
