import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamPreview } from '@/components/onboarding/team-preview';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const team = {
    name: 'Atlas',
    color: 'lagoon' as const,
    address: 'skrum.test/t/atlas',
};

describe('TeamPreview', () => {
    it('shows the team as the switcher and the team card will, then the steps to come', () => {
        renderWithProviders(
            <TeamPreview
                step="team"
                team={team}
                workspaceName="Nordlys"
                membersCount={0}
                invitedCount={0}
            />,
        );

        expect(screen.getByText('Nordlys · 1 member')).toBeTruthy();
        expect(screen.getByText('skrum.test/t/atlas')).toBeTruthy();
        expect(screen.getByText('No sessions yet')).toBeTruthy();
        expect(
            document.querySelector('[data-slot="team-mark"]')?.className,
        ).toContain('col-lagoon');
        expect(
            screen.getAllByRole('listitem').map((item) => item.textContent),
        ).toEqual([
            '3Invite your teammates by email or link',
            '4Pick a first ritual — a retro takes 2 minutes to set up',
        ]);
    });

    it('counts the pending invitations and has nothing to come at the last step', () => {
        renderWithProviders(
            <TeamPreview
                step="ritual"
                team={team}
                workspaceName="Nordlys"
                membersCount={2}
                invitedCount={3}
            />,
        );

        expect(screen.getByText('Nordlys · 2 members')).toBeTruthy();
        expect(screen.getByText('3 pending invitations')).toBeTruthy();
        expect(screen.queryByText('Coming next')).toBeNull();
    });
});
