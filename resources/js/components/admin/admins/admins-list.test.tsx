import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminsList } from '@/components/admin/admins/admins-list';
import type { InstanceAdmin } from '@/components/admin/admins/types';
import { renderWithProviders } from '@/test/render';

const ada: InstanceAdmin = {
    id: 'a1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    avatarUrl: '/avatars/a.svg',
    isSelf: true,
    canRevoke: true,
};

const grace: InstanceAdmin = {
    id: 'a2',
    name: 'Grace Hopper',
    email: 'grace@example.com',
    avatarUrl: '/avatars/b.svg',
    isSelf: false,
    canRevoke: true,
};

describe('AdminsList', () => {
    it('renders one row per admin with the name and the email', () => {
        renderWithProviders(
            <AdminsList admins={[ada, grace]} onRevoke={vi.fn()} />,
        );

        const table = screen.getByRole('table', { name: 'Instance admins' });
        const rows = within(table).getAllByRole('row');

        expect(rows).toHaveLength(3);
        expect(within(rows[1]).getByText('Ada Lovelace')).toBeTruthy();
        expect(within(rows[1]).getByText('ada@example.com')).toBeTruthy();
        expect(within(rows[2]).getByText('Grace Hopper')).toBeTruthy();
        expect(within(rows[2]).getByText('grace@example.com')).toBeTruthy();
    });

    it('marks only the signed-in admin with the "You" badge', () => {
        renderWithProviders(
            <AdminsList admins={[ada, grace]} onRevoke={vi.fn()} />,
        );

        const rows = screen.getAllByRole('row');

        expect(within(rows[1]).getByText('You')).toBeTruthy();
        expect(within(rows[2]).queryByText('You')).toBeNull();
    });

    it('reports the admin whose revoke button is pressed', () => {
        const onRevoke = vi.fn();
        renderWithProviders(
            <AdminsList admins={[ada, grace]} onRevoke={onRevoke} />,
        );

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Revoke admin rights of Grace Hopper',
            }),
        );

        expect(onRevoke).toHaveBeenCalledWith(grace);
    });

    it('disables revoke for the last admin and gives the reason', () => {
        const onRevoke = vi.fn();
        renderWithProviders(
            <AdminsList
                admins={[{ ...ada, canRevoke: false }]}
                onRevoke={onRevoke}
            />,
        );

        const button = screen.getByRole<HTMLButtonElement>('button', {
            name: 'Revoke admin rights of Ada Lovelace',
        });
        const reason = screen.getByText(
            'An instance needs at least one admin.',
        );

        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(button.getAttribute('aria-describedby')).toBe(reason.id);

        button.focus();

        expect(document.activeElement).toBe(button);

        fireEvent.click(button);

        expect(onRevoke).not.toHaveBeenCalled();
    });

    it('gives no reason when the admin can be revoked', () => {
        renderWithProviders(<AdminsList admins={[ada]} onRevoke={vi.fn()} />);

        expect(
            screen.queryByText('An instance needs at least one admin.'),
        ).toBeNull();
    });

    it('says so when there is no admin', () => {
        renderWithProviders(<AdminsList admins={[]} onRevoke={vi.fn()} />);

        expect(screen.getByText('No instance admin yet.')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
    });
});
