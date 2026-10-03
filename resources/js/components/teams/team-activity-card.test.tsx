import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamActivityCard } from '@/components/teams/team-activity-card';
import { renderWithProviders } from '@/test/render';
import type { TeamActivityLine } from '@/types';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string;
            children: React.ReactNode;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

const minutesAgo = (minutes: number): string =>
    new Date(Date.now() - minutes * 60_000).toISOString();

const lines: TeamActivityLine[] = [
    {
        id: 'line-1',
        kind: 'poker_started',
        actor: { name: 'Camille Roux', avatarUrl: '/avatars/camille.svg' },
        subject: { title: 'Sprint 43 refinement', url: '/poker/game-1' },
        at: minutesAgo(34),
    },
    {
        id: 'line-2',
        kind: 'action_item_completed',
        actor: { name: 'Jira', avatarUrl: null },
        subject: { title: 'Quarantine the flaky tests', url: null },
        at: minutesAgo(60 * 3),
    },
    {
        id: 'line-3',
        kind: 'member_joined',
        actor: { name: 'Noa Kim', avatarUrl: null },
        subject: null,
        at: minutesAgo(60 * 30),
    },
];

describe('the activity of a team', () => {
    it('reads each line as the actor, the verb and the subject, with a link while the subject exists', () => {
        const { container } = renderWithProviders(
            <TeamActivityCard lines={lines} />,
        );
        const items = container.querySelectorAll(
            '#activity li[data-test="activity-line"]',
        );

        expect(
            screen.getByRole('heading', { level: 2, name: 'Activity' }),
        ).toBeTruthy();
        expect(items).toHaveLength(3);
        expect(items[0].textContent).toContain(
            'Camille Roux started the planning poker Sprint 43 refinement',
        );
        expect(
            screen
                .getByRole('link', { name: 'Sprint 43 refinement' })
                .getAttribute('href'),
        ).toBe('/poker/game-1');
        expect(items[1].textContent).toContain(
            'Jira completed Quarantine the flaky tests',
        );
        expect(items[1].querySelector('a')).toBeNull();
        expect(items[2].textContent).toContain('Noa Kim joined the team');
    });

    it('draws the initials for a guest or a tracker, and the time relative to now', () => {
        const { container } = renderWithProviders(
            <TeamActivityCard lines={lines} />,
        );
        const items = container.querySelectorAll('[data-test="activity-line"]');

        expect(items[1].querySelector('img')).toBeNull();
        expect(
            items[1].querySelector('[data-slot="avatar-fallback"]')
                ?.textContent,
        ).toBe('J');
        expect(items[0].textContent).toContain('34 minutes ago');
        expect(items[2].textContent).toContain('yesterday');
    });

    it('says so when nothing has happened yet', () => {
        renderWithProviders(<TeamActivityCard lines={[]} />);

        expect(
            screen.getByText('Nothing has happened in this team yet.'),
        ).toBeTruthy();
    });
});
