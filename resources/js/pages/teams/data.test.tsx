import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamDataPage from './data';

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

describe('the Data & export tab of the team settings', () => {
    it('opens the shell on Data & export with the exports and what is kept', () => {
        renderWithProviders(
            <TeamDataPage
                workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
                team={{ id: 't1', name: 'Atlas', description: null }}
                sections={{
                    general: true,
                    members: true,
                    integrations: true,
                    data: true,
                    firstUrl: '/w/nordlys/teams/t1/settings',
                }}
                closedSurveys={[]}
                estimatesUrl="/w/nordlys/teams/t1/estimates"
                actionItemsUrl="/w/nordlys/action-items?team=t1"
            />,
        );

        const current = within(
            screen.getByRole('navigation', { name: 'Team settings' }),
        )
            .getAllByRole('link')
            .find((link) => link.getAttribute('aria-current') === 'page');

        expect(current?.textContent).toBe('Data & export');
        expect(screen.getByRole('region', { name: 'Exports' })).not.toBeNull();
        expect(
            screen.getByRole('region', { name: 'What is kept' }),
        ).not.toBeNull();
    });
});
