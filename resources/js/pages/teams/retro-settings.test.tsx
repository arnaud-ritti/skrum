import { screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamRitualsPage from './rituals';

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

type Props = ComponentProps<typeof TeamRitualsPage>;

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
    healthStatements: [
        {
            id: 'interaction',
            key: 'interaction',
            label: 'Interaction',
            text: 'Interaction with colleagues was productive',
            isBuiltin: true,
            isArchived: false,
        },
    ],
    canManageHealthStatements: true,
};

describe('the Rituals section of the team settings', () => {
    it('shows the sprints, the facilitators, the templates and the health statements on Rituals', () => {
        renderWithProviders(<TeamRitualsPage {...props} />);

        const current = within(
            screen.getByRole('navigation', { name: 'Team settings' }),
        )
            .getAllByRole('link')
            .find((link) => link.getAttribute('aria-current') === 'page');

        expect(current?.textContent).toBe('Rituals');
        expect(
            document.querySelector('[data-slot="team-settings-facts"]')
                ?.textContent,
        ).toBe('Product squad · created in March 2025');
        expect(document.querySelector('section#members')).toBeNull();
        expect(document.querySelector('section#sprints')).not.toBeNull();
        expect(document.querySelector('section#facilitators')).not.toBeNull();
        expect(
            document.querySelector('section#retro-templates'),
        ).not.toBeNull();
        expect(
            document.querySelector('section#default-columns')?.textContent,
        ).toContain('Liked');
        expect(
            document.querySelector('[data-slot="health-statements"]')
                ?.textContent,
        ).toContain('Interaction with colleagues was productive');
    });

    it('leaves out the default columns while the team has no default template', () => {
        renderWithProviders(
            <TeamRitualsPage
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
