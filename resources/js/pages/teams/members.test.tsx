import { screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamMembersPage from './members';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: {}, locale: 'en', currentTeam: null },
    }),
    Head: () => null,
}));

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
        members: true,
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
    availableMembers: [],
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
};

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
});
