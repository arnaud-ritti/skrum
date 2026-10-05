import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, UsersPageProps } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import AdminUsers from './users';

const router = vi.hoisted(() => ({
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    visit: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Head: () => null,
    router,
}));

vi.mock('@/components/admin/admin-shell', () => ({
    AdminShell: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

function account(overrides: Partial<AdminUser> = {}): AdminUser {
    return {
        id: 'user-1',
        name: 'Théo Martin',
        email: 'theo@atlas.fr',
        avatarUrl: '',
        isAdmin: false,
        isDeactivated: false,
        hasSecondFactor: false,
        workspacesCount: 1,
        createdAt: '2026-09-12T09:00:00Z',
        lastSignedInAt: null,
        isSelf: false,
        ...overrides,
    };
}

function props(overrides: Partial<UsersPageProps> = {}): UsersPageProps {
    return {
        users: { data: [account()], current_page: 1, last_page: 1, total: 1 },
        filters: { query: null, status: 'all' },
        activeAdminCount: 1,
        ...overrides,
    };
}

async function openMenu(name: string): Promise<void> {
    await userEvent.click(
        within(
            document.querySelector('[data-slot="users-table"]') as HTMLElement,
        ).getByRole('button', { name: `Actions for ${name}` }),
    );
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    Object.values(router).forEach((mock) => mock.mockReset());
});

describe('AdminUsers', () => {
    it('opens the deactivation dialog for the account of the row', async () => {
        renderWithProviders(<AdminUsers {...props()} />);

        await openMenu('Théo Martin');
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Deactivate' }),
        );

        expect(
            within(screen.getByRole('alertdialog')).getByText(
                'Deactivate Théo Martin?',
            ),
        ).toBeTruthy();
    });

    it('reactivates an account with DELETE, without a dialog', async () => {
        renderWithProviders(
            <AdminUsers
                {...props({
                    users: {
                        data: [account({ isDeactivated: true })],
                        current_page: 1,
                        last_page: 1,
                        total: 1,
                    },
                })}
            />,
        );

        await openMenu('Théo Martin');
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Reactivate' }),
        );

        expect(router.delete).toHaveBeenCalledWith(
            '/admin/users/user-1/deactivation',
            expect.objectContaining({ preserveScroll: true }),
        );
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('says when no account matches the search', () => {
        renderWithProviders(
            <AdminUsers
                {...props({
                    users: {
                        data: [],
                        current_page: 1,
                        last_page: 1,
                        total: 0,
                    },
                    filters: { query: 'nobody', status: 'all' },
                })}
            />,
        );

        expect(
            screen.getByText('No account matches your search.'),
        ).toBeTruthy();
        expect(document.querySelector('[data-slot="users-table"]')).toBeNull();
    });

    it('blames the filter, not a search, when only the filter is set', () => {
        renderWithProviders(
            <AdminUsers
                {...props({
                    users: {
                        data: [],
                        current_page: 1,
                        last_page: 1,
                        total: 0,
                    },
                    filters: { query: null, status: 'deactivated' },
                })}
            />,
        );

        expect(screen.getByText('No account in this state.')).toBeTruthy();
        expect(
            screen.queryByText('No account matches your search.'),
        ).toBeNull();
    });

    it('links each page with the search and the filter', () => {
        renderWithProviders(
            <AdminUsers
                {...props({
                    users: {
                        data: [account()],
                        current_page: 2,
                        last_page: 3,
                        total: 60,
                    },
                    filters: { query: 'atlas', status: 'active' },
                })}
            />,
        );

        const pagination = within(
            screen.getByRole('navigation', { name: 'Pagination' }),
        );

        expect(
            pagination
                .getByRole('link', { name: 'Go to page 3' })
                .getAttribute('href'),
        ).toBe('/admin/users?query=atlas&status=active&page=3');
        expect(
            pagination
                .getByRole('link', { name: 'Go to page 2' })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('hides the pagination on a single page', () => {
        renderWithProviders(<AdminUsers {...props()} />);

        expect(
            screen.queryByRole('navigation', { name: 'Pagination' }),
        ).toBeNull();
    });
});
