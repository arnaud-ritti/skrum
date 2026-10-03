import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { UsersTable } from './users-table';

const router = vi.hoisted(() => ({ visit: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router,
}));

function account(overrides: Partial<AdminUser> = {}): AdminUser {
    return {
        id: 'user-1',
        name: 'Camille Roux',
        email: 'camille@atlas.fr',
        avatarUrl: '',
        isAdmin: false,
        isDeactivated: false,
        hasSecondFactor: false,
        workspacesCount: 2,
        createdAt: '2026-09-12T09:00:00Z',
        lastSignedInAt: null,
        isSelf: false,
        ...overrides,
    };
}

function render(
    users: AdminUser[],
    activeAdminCount = 2,
): {
    onDeactivate: ReturnType<typeof vi.fn>;
    onReactivate: ReturnType<typeof vi.fn>;
} {
    const onDeactivate = vi.fn();
    const onReactivate = vi.fn();

    renderWithProviders(
        <UsersTable
            users={users}
            now={Date.parse('2026-10-03T12:00:00Z')}
            activeAdminCount={activeAdminCount}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
        />,
    );

    return { onDeactivate, onReactivate };
}

function table(): ReturnType<typeof within> {
    return within(
        document.querySelector('[data-slot="users-table"]') as HTMLElement,
    );
}

async function openMenu(name: string): Promise<void> {
    await userEvent.click(
        table().getByRole('button', { name: `Actions for ${name}` }),
    );
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    router.visit.mockReset();
});

describe('UsersTable', () => {
    it('shows the account, its workspaces, its dates and a dash before any sign-in', () => {
        render([account()]);

        const row = within(table().getByRole('row', { name: /Camille Roux/ }));

        expect(row.getByText('camille@atlas.fr')).toBeTruthy();
        expect(row.getByText('2')).toBeTruthy();
        expect(row.getByText('Sep 12, 2026')).toBeTruthy();
        expect(row.getByText('—')).toBeTruthy();
    });

    it('shows the last sign-in relative to now', () => {
        render([account({ lastSignedInAt: '2026-10-01T12:00:00Z' })]);

        expect(table().getByText('2 days ago')).toBeTruthy();
    });

    it('marks admins, deactivated accounts and second factors', () => {
        render([
            account({
                isAdmin: true,
                isDeactivated: true,
                hasSecondFactor: true,
            }),
        ]);

        const badges = within(
            table()
                .getByRole('row', { name: /Camille Roux/ })
                .querySelector('[data-slot="user-badges"]') as HTMLElement,
        );

        expect(badges.getByText('Admin')).toBeTruthy();
        expect(badges.getByText('Deactivated')).toBeTruthy();
        expect(badges.getByText('2FA on')).toBeTruthy();
    });

    it('shows no badge for a plain active account', () => {
        render([account()]);

        expect(document.querySelector('[data-slot="user-badges"]')).toBeNull();
    });

    it('asks to deactivate an account from its menu', async () => {
        const { onDeactivate } = render([account()]);

        await openMenu('Camille Roux');
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Deactivate' }),
        );

        expect(onDeactivate).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'user-1' }),
        );
    });

    it('refuses to deactivate oneself and says why', async () => {
        const { onDeactivate } = render([account({ isSelf: true })]);

        await openMenu('Camille Roux');

        const item = screen.getByRole('menuitem', { name: /Deactivate/ });

        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(item.textContent).toContain("You can't deactivate yourself");

        await userEvent.click(item);

        expect(onDeactivate).not.toHaveBeenCalled();
    });

    it('refuses to deactivate the last active admin and says why', async () => {
        render([account({ isAdmin: true })], 1);

        await openMenu('Camille Roux');

        const item = screen.getByRole('menuitem', { name: /Deactivate/ });

        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(item.textContent).toContain(
            'The instance needs an active admin',
        );
    });

    it('lets an admin be deactivated while another admin stays active', async () => {
        render([account({ isAdmin: true })], 2);

        await openMenu('Camille Roux');

        expect(
            screen
                .getByRole('menuitem', { name: 'Deactivate' })
                .getAttribute('aria-disabled'),
        ).toBeNull();
    });

    it('reactivates a deactivated account from its menu', async () => {
        const { onReactivate } = render([account({ isDeactivated: true })]);

        await openMenu('Camille Roux');
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Reactivate' }),
        );

        expect(onReactivate).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'user-1' }),
        );
        expect(
            screen.queryByRole('menuitem', { name: 'Make admin' }),
        ).toBeNull();
    });

    it('opens the admins section to make an account admin', async () => {
        render([account()]);

        await openMenu('Camille Roux');
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Make admin' }),
        );

        expect(router.visit).toHaveBeenCalledWith('/admin/admins');
    });

    it('offers no "Make admin" for an admin', async () => {
        render([account({ isAdmin: true })]);

        await openMenu('Camille Roux');

        expect(
            screen.queryByRole('menuitem', { name: 'Make admin' }),
        ).toBeNull();
    });
});
