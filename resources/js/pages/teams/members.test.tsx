import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamMembersPage from './members';

const mocks = vi.hoisted(() => ({ reload: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: {}, locale: 'en', currentTeam: null },
    }),
    Head: () => null,
    router: { reload: mocks.reload, post: vi.fn(), delete: vi.fn() },
}));

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/hooks/use-min-width', () => ({ useMinWidth: () => true }));

type Props = ComponentProps<typeof TeamMembersPage>;

const props: Props = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 't1', name: 'Atlas', description: 'Product squad' },
    createdAt: '2025-03-10T09:00:00+00:00',
    sections: {
        general: true,
        rituals: true,
        integrations: true,
        data: true,
        firstUrl: '/w/nordlys/teams/t1/settings',
    },
    members: [
        {
            id: 'u1',
            name: 'Arnaud Ritti',
            email: 'arnaud@example.com',
            avatarUrl: '',
            role: 'owner',
            lastActiveAt: null,
            isViewer: true,
        },
    ],
    canManageMembers: true,
    roleOptions: [
        { value: 'owner', label: 'Owner' },
        { value: 'facilitator', label: 'Facilitator' },
        { value: 'member', label: 'Member' },
        { value: 'observer', label: 'Observer' },
    ],
    sprints: {
        list: [],
        total: 0,
        current: null,
        nextRetro: null,
        nextStart: {
            number: 1,
            startsOn: '2026-09-30',
            endsOn: '2026-10-13',
            refusal: null,
        },
        timeZone: 'UTC',
    },
    rituals: { sprintLengthWeeks: null, retroWeekday: null, retroTime: null },
    facilitators: {
        list: [],
        rotation: false,
        suggested: null,
        candidates: [],
    },
    templates: [
        {
            key: 'four_ls',
            name: '4L',
            category: 'essentials',
            columns: [{ title: 'Liked', description: null, color: 'moss' }],
            usageCount: 2,
            isDefault: true,
            templateId: null,
            canEdit: false,
        },
    ],
    defaultRetroTemplate: 'four_ls',
    defaultRetroTemplateUnavailable: false,
    categories: [{ value: 'essentials', label: 'Essentials' }],
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

describe('the Members & rituals tab of the team settings', () => {
    it('opens the shell on Members & rituals with the four cards of the mockup', () => {
        renderWithProviders(<TeamMembersPage {...props} />);

        const current = within(
            screen.getByRole('navigation', { name: 'Team settings' }),
        )
            .getAllByRole('link')
            .find((link) => link.getAttribute('aria-current') === 'page');

        expect(current?.textContent).toBe('Members & rituals');
        expect(
            document.querySelector('[data-slot="team-settings-facts"]')
                ?.textContent,
        ).toBe('Product squad · 1 member · created in March 2025');
        expect(document.querySelector('section#members')).not.toBeNull();
        expect(
            document.querySelector('section#members + section#sprints'),
        ).not.toBeNull();
        expect(document.querySelector('section#facilitators')).not.toBeNull();
        expect(
            document.querySelector('section#retro-templates'),
        ).not.toBeNull();
        expect(
            document.querySelector('section#default-columns')?.textContent,
        ).toContain('Liked');
    });

    it('leaves out the default columns while the team has no default template', () => {
        renderWithProviders(
            <TeamMembersPage
                {...props}
                templates={props.templates.map((template) => ({
                    ...template,
                    isDefault: false,
                }))}
                defaultRetroTemplate={null}
            />,
        );

        expect(document.querySelector('section#default-columns')).toBeNull();
    });

    it('gives the team inviters the invitations of the team, "Invitation link" and "Invite"', () => {
        renderWithProviders(
            <TeamMembersPage
                {...props}
                canInvite
                pendingInvitations={invitations}
            />,
        );
        const card = document.querySelector<HTMLElement>('section#members')!;

        expect(
            card.querySelector('[data-slot="settings-panel-subtitle"]')
                ?.textContent,
        ).toBe('1 member · 2 pending invitations');
        expect(
            within(card).getByRole('button', { name: 'Invitation link' }),
        ).toBeTruthy();
        expect(
            within(card).getByRole('button', { name: 'Invite' }),
        ).toBeTruthy();
        expect(
            card.querySelectorAll('[data-slot="pending-invitation"]'),
        ).toHaveLength(3);
    });

    it('shows a facilitator the invitations with Resend and revoke, but no role select', () => {
        renderWithProviders(
            <TeamMembersPage
                {...props}
                canManageMembers={false}
                canInvite
                pendingInvitations={invitations}
            />,
        );
        const card = document.querySelector<HTMLElement>('section#members')!;

        expect(
            within(card).getByRole('button', {
                name: 'Resend the invitation of lucas@example.com',
            }),
        ).toBeTruthy();
        expect(
            within(card).getByRole('button', {
                name: 'Revoke the invitation of lucas@example.com',
            }),
        ).toBeTruthy();
        expect(within(card).queryByRole('combobox')).toBeNull();
    });

    it('shows neither the invitations nor the buttons to who may not invite', () => {
        renderWithProviders(<TeamMembersPage {...props} />);
        const card = document.querySelector<HTMLElement>('section#members')!;

        expect(
            within(card).queryByRole('button', { name: 'Invite' }),
        ).toBeNull();
        expect(
            card.querySelector('[data-slot="settings-panel-subtitle"]')
                ?.textContent,
        ).toBe('1 member');
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
