import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MembersTable } from '@/components/workspaces/members-table';
import type { WorkspaceMembersProps } from '@/components/workspaces/members-table';
import { renderWithProviders } from '@/test/render';
import type { WorkspaceMember, WorkspaceRole } from '@/types';

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        auth: { user: { id: 'u1' } },
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: mocks.props }),
    router: { post: mocks.post, patch: mocks.patch, delete: mocks.delete },
}));

vi.mock('sonner', () => ({
    toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

function member(
    id: string,
    name: string,
    role: WorkspaceRole,
): WorkspaceMember {
    return {
        id,
        name,
        email: `${name.toLowerCase().split(' ')[0]}@example.com`,
        avatarUrl: '',
        role,
    };
}

const base: WorkspaceMembersProps = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    members: [
        member('u1', 'Arnaud Ritti', 'owner'),
        member('u2', 'Camille Roux', 'admin'),
        member('u3', 'Theo Martin', 'member'),
    ],
    invitations: [
        {
            id: 'i1',
            email: 'lucas@example.com',
            role: 'member',
            team: null,
            teamRole: null,
            status: 'pending',
            isExpired: false,
            invitedAt: '2026-09-26T09:00:00+00:00',
        },
        {
            id: 'i2',
            email: 'sofia@example.com',
            role: 'admin',
            team: null,
            teamRole: null,
            status: 'expired',
            isExpired: true,
            invitedAt: '2026-09-12T09:00:00+00:00',
        },
    ],
    teams: [{ id: 't1', name: 'Atlas' }],
    teamRoles: ['facilitator', 'member', 'observer'],
    invitationValidForDays: 7,
    isOwner: true,
};

function table(props: Partial<Parameters<typeof MembersTable>[0]> = {}) {
    return renderWithProviders(
        <MembersTable {...base} currentUserId="u1" {...props} />,
    );
}

function memberRow(id: string): HTMLElement {
    return document.querySelector(
        `[data-slot="member-row"][data-member-id="${id}"]`,
    ) as HTMLElement;
}

function invitationRow(email: string): HTMLElement {
    return document.querySelector(
        `[data-slot="invitation-row"][data-invitation-email="${email}"]`,
    ) as HTMLElement;
}

async function openMenu(name: string): Promise<void> {
    await userEvent.click(
        screen.getByRole('button', { name: `Actions for ${name}` }),
    );
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.delete.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
});

describe('MembersTable', () => {
    it('counts the members and the invitations that still wait', () => {
        table();

        expect(
            screen.getByRole('heading', { level: 2, name: 'Members' }),
        ).toBeTruthy();
        expect(
            document.querySelector('[data-slot="members-summary"]')
                ?.textContent,
        ).toBe('3 members · 1 pending invitation');
    });

    it('says nothing of invitations when none waits', () => {
        table({ members: base.members.slice(0, 1), invitations: [] });

        expect(
            document.querySelector('[data-slot="members-summary"]')
                ?.textContent,
        ).toBe('1 member');
        expect(
            document.querySelectorAll('[data-slot="invitation-row"]'),
        ).toHaveLength(0);
    });

    it('lists each member with the name, the address and "(you)" on the viewer', () => {
        table();

        expect(memberRow('u1').textContent).toContain('Arnaud Ritti (you)');
        expect(memberRow('u1').textContent).toContain('arnaud@example.com');
        expect(memberRow('u2').textContent).toContain('Camille Roux');
        expect(memberRow('u2').textContent).not.toContain('(you)');
    });

    it('gives an owner a role select on every row, owners included', () => {
        table();

        expect(screen.getAllByRole('combobox', { name: 'Role' })).toHaveLength(
            3,
        );
    });

    it('shows an admin the owner as a badge, without a select and without a menu', () => {
        table({ isOwner: false, currentUserId: 'u2' });

        const owner = memberRow('u1');

        expect(within(owner).queryByRole('combobox')).toBeNull();
        expect(within(owner).queryByRole('button')).toBeNull();
        expect(within(owner).getByText('Owner')).toBeTruthy();
        expect(screen.getAllByRole('combobox', { name: 'Role' })).toHaveLength(
            2,
        );
    });

    it('does not offer ownership to an admin', async () => {
        table({ isOwner: false, currentUserId: 'u2' });

        await userEvent.click(
            within(memberRow('u3')).getByRole('combobox', { name: 'Role' }),
        );

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['Admin', 'Member']);
    });

    it('patches the role chosen and shows the refusal of the server under the select', async () => {
        table();

        await userEvent.click(
            within(memberRow('u1')).getByRole('combobox', { name: 'Role' }),
        );
        await userEvent.click(screen.getByRole('option', { name: 'Member' }));

        expect(mocks.patch).toHaveBeenCalledTimes(1);
        expect(mocks.patch.mock.calls[0][0]).toBe('/w/nordlys/members/u1');
        expect(mocks.patch.mock.calls[0][1]).toEqual({ role: 'member' });

        await act(async () => {
            (mocks.patch.mock.calls[0][2] as VisitOptions).onError?.({
                role: 'A workspace needs at least one owner.',
            });
        });

        expect(
            memberRow('u1').querySelector('[data-slot="member-role-error"]')
                ?.textContent,
        ).toBe('A workspace needs at least one owner.');
        expect(
            memberRow('u2').querySelector('[data-slot="member-role-error"]'),
        ).toBeNull();
    });

    it('asks before a member is removed, and removes on confirmation', async () => {
        table();

        await openMenu('Theo Martin');
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Remove from workspace' }),
        );

        const dialog = screen.getByRole('alertdialog', {
            name: 'Remove Theo Martin from this workspace?',
        });

        expect(mocks.delete).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', {
                name: 'Remove from workspace',
            }),
        );

        expect(mocks.delete).toHaveBeenCalledTimes(1);
        expect(mocks.delete.mock.calls[0][0]).toBe('/w/nordlys/members/u3');

        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onSuccess?.();
        });

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('keeps the member when the removal is cancelled', async () => {
        table();

        await openMenu('Theo Martin');
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Remove from workspace' }),
        );
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Cancel',
            }),
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('shows the refusal of the server in the removal dialog', async () => {
        table();

        await openMenu('Camille Roux');
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Remove from workspace' }),
        );
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Remove from workspace',
            }),
        );
        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onError?.({
                member: 'A workspace needs at least one owner.',
            });
        });

        await waitFor(() =>
            expect(
                within(screen.getByRole('alertdialog')).getByRole('alert')
                    .textContent,
            ).toBe('A workspace needs at least one owner.'),
        );
    });

    it('offers the viewer "Leave" on their own row, behind the typed name', async () => {
        table();

        await openMenu('Arnaud Ritti');

        expect(
            screen.queryByRole('menuitem', { name: 'Remove from workspace' }),
        ).toBeNull();

        await userEvent.click(screen.getByRole('menuitem', { name: 'Leave' }));

        const dialog = screen.getByRole('dialog', { name: 'Leave Nordlys?' });

        expect(dialog.textContent).toContain(
            "You're one of 2 admins — Camille Roux stays admin.",
        );
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('lists a waiting invitation with its role, its day and its state', () => {
        table();

        const pending = invitationRow('lucas@example.com');
        const expired = invitationRow('sofia@example.com');

        expect(
            pending.querySelector('[data-slot="invitation-details"]')
                ?.textContent,
        ).toBe('Member · Invited on Sep 26');
        expect(within(pending).getByText('Invitation pending')).toBeTruthy();
        expect(within(pending).queryByText('Expired')).toBeNull();
        expect(
            expired.querySelector('[data-slot="invitation-details"]')
                ?.textContent,
        ).toBe('Admin · Invited on Sep 12');
        expect(within(expired).getByText('Expired')).toBeTruthy();
        expect(within(expired).queryByText('Invitation pending')).toBeNull();
    });

    it('sends the invitation again through its own resend, one at a time', async () => {
        table();

        await userEvent.click(
            screen.getByRole('button', {
                name: 'Resend the invitation of sofia@example.com',
            }),
        );

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][0]).toBe(
            '/w/nordlys/invitations/i2/resend',
        );
        expect(mocks.post.mock.calls[0][1]).toEqual({});

        const visit = mocks.post.mock.calls[0][2] as VisitOptions;

        await act(async () => {
            visit.onStart?.();
        });
        await userEvent.click(
            screen.getByRole('button', {
                name: 'Resend the invitation of lucas@example.com',
            }),
        );
        expect(mocks.post).toHaveBeenCalledTimes(1);

        await act(async () => {
            visit.onSuccess?.();
            visit.onFinish?.();
        });

        expect(mocks.toastSuccess).toHaveBeenCalledWith(
            'Invitation sent again to sofia@example.com.',
        );
    });

    it('names the team of an invitation with its team role, and a declined one', () => {
        table({
            invitations: [
                {
                    id: 'i3',
                    email: 'nadia@example.com',
                    role: 'member',
                    team: { id: 't1', name: 'Atlas' },
                    teamRole: 'observer',
                    status: 'declined',
                    isExpired: true,
                    invitedAt: '2026-09-20T09:00:00+00:00',
                },
            ],
        });

        const declined = invitationRow('nadia@example.com');

        expect(
            declined.querySelector('[data-slot="invitation-details"]')
                ?.textContent,
        ).toBe('Member · Atlas (Observer) · Invited on Sep 20');
        expect(within(declined).getByText('Declined')).toBeTruthy();
        expect(within(declined).queryByText('Expired')).toBeNull();
        expect(within(declined).queryByText('Invitation pending')).toBeNull();
        expect(
            document.querySelector('[data-slot="members-summary"]')
                ?.textContent,
        ).toBe('3 members');
    });

    it('offers the teams of the workspace and a message in the invite dialog', async () => {
        table();

        await userEvent.click(screen.getByRole('button', { name: 'Invite' }));

        const dialog = screen.getByRole('dialog');

        expect(
            within(dialog).getByRole('combobox', { name: 'Team · optional' }),
        ).toBeTruthy();
        expect(
            within(dialog).getByLabelText('Message · optional'),
        ).toBeTruthy();
    });

    it('shows the refusal of a resend in the row', async () => {
        table();

        await userEvent.click(
            screen.getByRole('button', {
                name: 'Resend the invitation of lucas@example.com',
            }),
        );
        await act(async () => {
            const visit = mocks.post.mock.calls[0][2] as VisitOptions;

            visit.onStart?.();
            visit.onError?.({
                email: 'This person is already a member of the workspace.',
            });
            visit.onFinish?.();
        });

        expect(
            within(invitationRow('lucas@example.com')).getByRole('alert')
                .textContent,
        ).toBe('This person is already a member of the workspace.');
        expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });

    it('asks before an invitation is revoked; Cancel keeps it', async () => {
        table();

        await userEvent.click(
            screen.getByRole('button', {
                name: 'Revoke the invitation of lucas@example.com',
            }),
        );

        const dialog = screen.getByRole('alertdialog', {
            name: 'Revoke the invitation of lucas@example.com?',
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('revokes the invitation on confirmation', async () => {
        table();

        await userEvent.click(
            screen.getByRole('button', {
                name: 'Revoke the invitation of lucas@example.com',
            }),
        );
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Revoke',
            }),
        );

        expect(mocks.delete).toHaveBeenCalledTimes(1);
        expect(mocks.delete.mock.calls[0][0]).toBe('/w/nordlys/invitations/i1');

        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onSuccess?.();
        });

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('shows the link of the invitation only when the server sent one', () => {
        const { unmount } = table();

        expect(
            document.querySelector('[data-slot="invitation-link"]'),
        ).toBeNull();
        unmount();

        table({ invitationUrl: 'https://skrum.test/invitations/abc' });

        const link = document.querySelector(
            '[data-slot="invitation-link"]',
        ) as HTMLElement;

        expect(link.textContent).toContain(
            'Email is not configured on this instance. Share this link with the invited person:',
        );
        expect(
            (within(link).getByRole('textbox') as HTMLInputElement).value,
        ).toBe('https://skrum.test/invitations/abc');
        expect(
            within(link).getByRole('button', { name: 'Copy link' }),
        ).toBeTruthy();
    });

    it('opens the invitation form from "Invite"', async () => {
        table();

        expect(screen.queryByRole('dialog')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Invite' }));

        expect(
            screen.getByRole('dialog', { name: 'Invite people' }),
        ).toBeTruthy();
    });

    it('leaves the places of the later features empty', () => {
        table();

        expect(
            document.querySelectorAll('[data-slot="members-header"] button'),
        ).toHaveLength(1);
    });
});
