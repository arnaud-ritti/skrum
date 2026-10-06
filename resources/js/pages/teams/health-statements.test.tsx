import { screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamHealthStatementsPage from './health-statements';

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

type Props = ComponentProps<typeof TeamHealthStatementsPage>;

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

describe('the Health check section of the team settings', () => {
    it('shows the health check statements, and none of the sprints or of the retrospectives', () => {
        renderWithProviders(<TeamHealthStatementsPage {...props} />);

        expect(currentSection()).toBe('Health check');
        expect(
            document.querySelector('[data-slot="health-statements"]')
                ?.textContent,
        ).toContain('Interaction with colleagues was productive');
        expect(screen.getByRole('textbox', { name: 'Statement' })).toBeTruthy();
        expect(document.querySelector('section#sprints')).toBeNull();
        expect(document.querySelector('section#facilitators')).toBeNull();
        expect(document.querySelector('section#retro-templates')).toBeNull();
        expect(document.querySelector('section#default-columns')).toBeNull();
    });

    it('lets who may not edit the statements read them, without the controls to change them', () => {
        renderWithProviders(
            <TeamHealthStatementsPage
                {...props}
                canManageHealthStatements={false}
            />,
        );

        expect(
            document.querySelector('[data-slot="health-statements"]')
                ?.textContent,
        ).toContain('Interaction with colleagues was productive');
        expect(screen.queryByRole('textbox', { name: 'Statement' })).toBeNull();
    });
});
