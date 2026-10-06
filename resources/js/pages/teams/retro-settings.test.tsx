import { screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamRetroSettingsPage from './retro-settings';

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

type Props = ComponentProps<typeof TeamRetroSettingsPage>;

const shell = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 't1', name: 'Atlas', description: 'Product squad' },
    createdAt: '2025-03-10T09:00:00+00:00',
    sections: {
        general: true,
        sprints: true,
        retros: true,
        health: true,
        integrations: true,
        data: true,
        firstUrl: '/w/nordlys/teams/t1/settings',
    },
};

function currentSection(): string | null | undefined {
    return within(screen.getByRole('navigation', { name: 'Team settings' }))
        .getAllByRole('link')
        .find((link) => link.getAttribute('aria-current') === 'page')
        ?.textContent;
}

const props: Props = {
    ...shell,
    nextRetro: null,
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

describe('the Retrospectives section of the team settings', () => {
    it('shows the facilitators, the templates and the default columns, and none of the sprints or of the health check', () => {
        renderWithProviders(<TeamRetroSettingsPage {...props} />);

        expect(currentSection()).toBe('Retrospectives');
        expect(document.querySelector('section#members')).toBeNull();
        expect(document.querySelector('section#facilitators')).not.toBeNull();
        expect(
            document.querySelector('section#retro-templates'),
        ).not.toBeNull();
        expect(
            document.querySelector('section#default-columns')?.textContent,
        ).toContain('Liked');
        expect(document.querySelector('section#sprints')).toBeNull();
        expect(
            document.querySelector('[data-slot="health-statements"]'),
        ).toBeNull();
    });

    it('leaves out the default columns while the team has no default template', () => {
        renderWithProviders(
            <TeamRetroSettingsPage
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
