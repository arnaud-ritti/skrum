import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamMembersPage from './members';

const mocks = vi.hoisted(() => ({ reload: vi.fn(), post: vi.fn() }));
const layout = vi.hoisted(() => ({
    title: undefined as string | undefined,
    active: undefined as string | undefined,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: {}, locale: 'en', currentTeam: null },
    }),
    Head: () => null,
    router: { reload: mocks.reload, post: mocks.post, delete: vi.fn() },
}));

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
    mocks.reload.mockReset();
});

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({
        title,
        active,
        children,
    }: {
        title: string;
        active?: string;
        children: ReactNode;
    }) => {
        layout.title = title;
        layout.active = active;

        return <main>{children}</main>;
    },
}));

vi.mock('@/hooks/use-min-width', () => ({ useMinWidth: () => true }));

type Props = ComponentProps<typeof TeamMembersPage>;

const roleOptions: Props['roleOptions'] = [
    { value: 'owner', label: 'Owner' },
    { value: 'facilitator', label: 'Facilitator' },
    { value: 'member', label: 'Member' },
    { value: 'observer', label: 'Observer' },
];

const props: Props = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 't1', name: 'Atlas', description: 'Product squad' },
    members: [
        {
            id: 'u1',
            name: 'Arnaud Ritti',
            email: 'arnaud@example.com',
            avatarUrl: '',
            role: 'member',
            lastActiveAt: null,
            isViewer: true,
        },
        {
            id: 'u2',
            name: 'Fran Facilitator',
            email: 'fran@example.com',
            avatarUrl: '',
            role: 'facilitator',
            lastActiveAt: null,
            isViewer: false,
        },
    ],
    canManageMembers: false,
    roleOptions: [],
    availableMembers: [],
    canInvite: false,
    inviteRoles: ['facilitator', 'member', 'observer'],
    pendingInvitations: [],
};

const invitations: Props['pendingInvitations'] = [
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
        teamRole: 'member',
        status: 'pending',
        invitedAt: '2026-09-27T10:00:00+00:00',
    },
    {
        id: 'i3',
        email: 'theo@example.com',
        teamRole: 'observer',
        status: 'declined',
        invitedAt: '2026-09-20T10:00:00+00:00',
    },
];

const olga: Props['availableMembers'][number] = {
    id: 'u9',
    name: 'Olga New',
    email: 'olga@example.com',
    avatarUrl: '',
};

function subtitle(): string | null | undefined {
    return document.querySelector('[data-slot="settings-panel-subtitle"]')
        ?.textContent;
}

describe('the Members page of a team', () => {
    it('shows a member the people and the note on roles, and no invite control', () => {
        renderWithProviders(<TeamMembersPage {...props} />);

        expect(layout.active).toBe('members');
        expect(layout.title).toBe('Members');
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Members · 2',
        );
        expect(
            screen.queryByRole('navigation', { name: 'Team settings' }),
        ).toBeNull();
        expect(document.querySelector('section#sprints')).toBeNull();
        expect(document.querySelectorAll('[data-member-id]')).toHaveLength(2);
        expect(screen.getByText('fran@example.com')).toBeTruthy();
        expect(screen.getByText('Facilitator')).toBeTruthy();
        expect(subtitle()).toBe('2 members');
        expect(
            screen.getByText(/^Facilitator: drives phases, timer and reveal/),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Invitation link' }),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="pending-invitation"]'),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Member actions' }),
        ).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('shows a facilitator Invite and the pending invitations', () => {
        renderWithProviders(
            <TeamMembersPage
                {...props}
                canInvite
                pendingInvitations={invitations}
            />,
        );

        expect(subtitle()).toBe('2 members · 2 pending invitations');
        expect(
            screen.getByRole('button', { name: 'Invitation link' }),
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Invite' })).toBeTruthy();
        expect(
            document.querySelectorAll('[data-slot="pending-invitation"]'),
        ).toHaveLength(3);
    });

    it('lets a facilitator resend and revoke an invitation, with no role select and no row action', () => {
        renderWithProviders(
            <TeamMembersPage
                {...props}
                canInvite
                pendingInvitations={invitations}
            />,
        );

        expect(
            screen.getByRole('button', {
                name: 'Resend the invitation of lucas@example.com',
            }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', {
                name: 'Revoke the invitation of lucas@example.com',
            }),
        ).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Member actions' }),
        ).toBeNull();
    });

    it('shows a manager the row actions', () => {
        renderWithProviders(
            <TeamMembersPage
                {...props}
                canManageMembers
                roleOptions={roleOptions}
            />,
        );

        expect(
            screen.getByRole('combobox', { name: 'Role of Fran Facilitator' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('combobox', { name: 'Role of Arnaud Ritti' }),
        ).toBeNull();
        expect(
            screen.getAllByRole('button', { name: 'Member actions' }),
        ).toHaveLength(1);
    });

    it('lets a manager add someone of the workspace to the team, with a role', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <TeamMembersPage
                {...props}
                canManageMembers
                roleOptions={roleOptions}
                availableMembers={[olga]}
            />,
        );

        await user.click(
            screen.getByRole('combobox', { name: 'Add a member' }),
        );
        await user.click(screen.getByRole('option', { name: 'Olga New' }));
        await user.click(screen.getByRole('combobox', { name: 'Add as' }));
        await user.click(screen.getByRole('option', { name: 'Observer' }));
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][0]).toBe('/w/nordlys/teams/t1/members');
        expect(mocks.post.mock.calls[0][1]).toEqual({
            user_id: 'u9',
            role: 'observer',
        });
    });

    it('has no add form for who may not manage the members, nor when nobody is left to add', () => {
        const { unmount } = renderWithProviders(
            <TeamMembersPage {...props} availableMembers={[olga]} />,
        );

        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();

        unmount();
        renderWithProviders(
            <TeamMembersPage
                {...props}
                canManageMembers
                roleOptions={roleOptions}
            />,
        );

        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
        expect(
            screen.queryByRole('combobox', { name: 'Add a member' }),
        ).toBeNull();
    });

    it('opens the invite dialog on the link with "Invitation link"', async () => {
        renderWithProviders(
            <TeamMembersPage
                {...props}
                canInvite
                inviteLink={{
                    url: 'https://skrum.test/invite/abc',
                    expiresAt: new Date(
                        Date.now() + 3 * 24 * 3600 * 1000,
                    ).toISOString(),
                    usesCount: 0,
                }}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Invitation link' }),
        );
        await act(async () => {});

        expect(mocks.reload).toHaveBeenCalledWith({ only: ['inviteLink'] });
        expect(document.activeElement?.textContent).toBe('Copy');
    });
});
