import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamSettingsPage from './settings';

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

const sections = {
    general: true,
    rituals: true,
    integrations: false,
    data: true,
    firstUrl: '/w/nordlys/teams/t1/settings',
};

describe('the General tab of the team settings', () => {
    it('opens the shell on General with the team card and the facts of the header', () => {
        renderWithProviders(
            <TeamSettingsPage
                workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
                team={{ id: 't1', name: 'Atlas', description: 'Product squad' }}
                createdAt="2025-03-10T09:00:00+00:00"
                membersCount={11}
                canDelete={false}
                sections={sections}
            />,
        );

        const current = within(
            screen.getByRole('navigation', { name: 'Team settings' }),
        )
            .getAllByRole('link')
            .find((link) => link.getAttribute('aria-current') === 'page');

        expect(current?.textContent).toBe('General');
        expect(
            document.querySelector('[data-slot="team-settings-facts"]')
                ?.textContent,
        ).toBe('Product squad · 11 members · created in March 2025');
        expect(screen.getByRole('region', { name: 'Team' })).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete team' }),
        ).toBeNull();
    });
});
