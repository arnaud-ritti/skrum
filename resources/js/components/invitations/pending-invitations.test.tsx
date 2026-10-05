import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    pendingInvitationCount,
    PendingInvitationRows,
    RevokePendingInvitationDialog,
    usePendingInvitationActions,
} from '@/components/invitations/pending-invitations';
import { Table, TableBody } from '@/components/ui/table';
import type { PendingInvitation } from '@/lib/invitations/types';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    only?: string[];
    onSuccess?: (page: { flash: Record<string, unknown> }) => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    delete: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { post: mocks.post, delete: mocks.delete },
}));

vi.mock('sonner', () => ({
    toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

const invitations: PendingInvitation[] = [
    {
        id: 'i1',
        email: 'lucas@example.com',
        teamRole: 'member',
        status: 'pending',
        invitedAt: '2026-09-26T10:00:00+00:00',
    },
    {
        id: 'i2',
        email: 'nadia@example.com',
        teamRole: 'facilitator',
        status: 'expired',
        invitedAt: '2026-09-01T10:00:00+00:00',
    },
    {
        id: 'i3',
        email: 'theo@example.com',
        teamRole: 'observer',
        status: 'declined',
        invitedAt: '2026-09-20T10:00:00+00:00',
    },
];

function Harness({ variant }: { variant: 'table' | 'list' }) {
    const actions = usePendingInvitationActions('nordlys');
    const rows = (
        <PendingInvitationRows
            invitations={invitations}
            actions={actions}
            variant={variant}
        />
    );

    return (
        <>
            {variant === 'table' ? (
                <Table>
                    <TableBody>{rows}</TableBody>
                </Table>
            ) : (
                <ul>{rows}</ul>
            )}
            <RevokePendingInvitationDialog actions={actions} />
            {actions.resent !== null && (
                <p data-testid="resent">
                    {actions.resent.email} {actions.resent.url}
                </p>
            )}
        </>
    );
}

function row(email: string): HTMLElement {
    const found = document.querySelector<HTMLElement>(
        `[data-invitation-email="${email}"]`,
    );

    if (found === null) {
        throw new Error(`No row for ${email}`);
    }

    return found;
}

beforeEach(() => {
    mocks.post.mockReset();
    mocks.delete.mockReset();
    mocks.toastSuccess.mockReset();
});

describe('the pending invitations of a team', () => {
    it('counts only the invitations still waiting', () => {
        expect(pendingInvitationCount(invitations)).toBe(1);
    });

    it.each(['table', 'list'] as const)(
        'shows each address, its date, its status and its team role (%s)',
        (variant) => {
            renderWithProviders(<Harness variant={variant} />);

            expect(row('lucas@example.com').textContent).toContain(
                'Invited on Sep 26',
            );
            expect(row('lucas@example.com').textContent).toContain(
                'Invitation pending',
            );
            expect(row('lucas@example.com').textContent).toContain('Member');
            expect(row('nadia@example.com').textContent).toContain('Expired');
            expect(row('nadia@example.com').textContent).toContain(
                'Facilitator',
            );
            expect(row('theo@example.com').textContent).toContain('Declined');
        },
    );

    it('resends an invitation and says so', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onSuccess?.({ flash: {} });
                options.onFinish?.();
            },
        );
        renderWithProviders(<Harness variant="table" />);

        await userEvent.click(
            within(row('lucas@example.com')).getByRole('button', {
                name: 'Resend the invitation of lucas@example.com',
            }),
        );

        expect(mocks.post).toHaveBeenCalledWith(
            '/w/nordlys/invitations/i1/resend',
            {},
            expect.objectContaining({ only: ['pendingInvitations'] }),
        );
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
            'Invitation sent again to lucas@example.com.',
        );
    });

    it('shows the error of a resend on its row', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onError?.({
                    email: 'This person is already in Atlas.',
                });
                options.onFinish?.();
            },
        );
        renderWithProviders(<Harness variant="table" />);

        await userEvent.click(
            within(row('lucas@example.com')).getByRole('button', {
                name: 'Resend the invitation of lucas@example.com',
            }),
        );

        expect(
            within(row('lucas@example.com')).getByRole('alert').textContent,
        ).toBe('This person is already in Atlas.');
    });

    it('says a resend that ended without an answer failed, on its row', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onFinish?.(),
        );
        renderWithProviders(<Harness variant="table" />);

        await userEvent.click(
            within(row('lucas@example.com')).getByRole('button', {
                name: 'Resend the invitation of lucas@example.com',
            }),
        );

        expect(
            within(row('lucas@example.com')).getByRole('alert').textContent,
        ).toBe('Something went wrong. Please try again.');
    });

    it('drops the handed-over link once its invitation is revoked', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onSuccess?.({
                    flash: { invitationUrl: 'https://skrum.test/i/abc' },
                });
                options.onFinish?.();
            },
        );
        mocks.delete.mockImplementation((_url: string, options: VisitOptions) =>
            options.onSuccess?.({ flash: {} }),
        );
        renderWithProviders(<Harness variant="table" />);

        await userEvent.click(
            within(row('lucas@example.com')).getByRole('button', {
                name: 'Resend the invitation of lucas@example.com',
            }),
        );

        expect(screen.getByTestId('resent').textContent).toBe(
            'lucas@example.com https://skrum.test/i/abc',
        );

        await userEvent.click(
            within(row('lucas@example.com')).getByRole('button', {
                name: 'Revoke the invitation of lucas@example.com',
            }),
        );
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Revoke',
            }),
        );

        expect(screen.queryByTestId('resent')).toBeNull();
    });

    it('revokes an invitation after a confirmation', async () => {
        mocks.delete.mockImplementation((_url: string, options: VisitOptions) =>
            options.onSuccess?.({ flash: {} }),
        );
        renderWithProviders(<Harness variant="table" />);

        await userEvent.click(
            within(row('nadia@example.com')).getByRole('button', {
                name: 'Revoke the invitation of nadia@example.com',
            }),
        );

        expect(mocks.delete).not.toHaveBeenCalled();

        const dialog = screen.getByRole('alertdialog');

        expect(dialog.textContent).toContain(
            'Revoke the invitation of nadia@example.com?',
        );

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Revoke' }),
        );

        expect(mocks.delete).toHaveBeenCalledWith(
            '/w/nordlys/invitations/i2',
            expect.objectContaining({ only: ['pendingInvitations'] }),
        );
    });
});
