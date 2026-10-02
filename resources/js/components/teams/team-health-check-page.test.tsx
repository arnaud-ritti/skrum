import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamHealthCheckPage } from '@/components/teams/team-health-check-page';
import type { TeamHealthCheckPageProps } from '@/components/teams/team-health-check-page';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Deferred: ({ fallback }: { fallback: () => React.ReactNode }) => (
            <>{fallback()}</>
        ),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
    };
});

const base: TeamHealthCheckPageProps = {
    workspace: { id: 'w', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 'team-1', name: 'Atlas' },
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

describe('the health check page of a team', () => {
    it('is titled "Health check" and holds the full manager of the statements', () => {
        const { container } = renderWithProviders(
            <TeamHealthCheckPage {...base} />,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Health check' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('region', { name: 'Health check statements' }),
        ).toBeTruthy();
        expect(screen.getByRole('textbox', { name: 'Statement' })).toBeTruthy();
        expect(
            container.querySelectorAll(
                '[data-slot="health-statements-active"] [data-action="reorder"]',
            ),
        ).toHaveLength(1);
    });

    it('lists the statements without a control for a member who cannot manage them', () => {
        const { container } = renderWithProviders(
            <TeamHealthCheckPage {...base} canManageHealthStatements={false} />,
        );

        expect(
            screen.getByText('Interaction with colleagues was productive'),
        ).toBeTruthy();
        expect(screen.queryByRole('textbox', { name: 'Statement' })).toBeNull();
        expect(container.querySelector('[data-action="reorder"]')).toBeNull();
    });

    it('draws the mood trend, a skeleton until it arrives, with its table view', () => {
        const { container, rerender } = renderWithProviders(
            <TeamHealthCheckPage {...base} />,
        );

        expect(
            container.querySelector('[data-slot="team-trend-loading"]'),
        ).not.toBeNull();

        rerender(
            <TeamHealthCheckPage
                {...base}
                moodTrend={[
                    {
                        retroId: 'retro-1',
                        title: 'Sprint 41',
                        completedAt: '2026-09-18T08:00:00+00:00',
                        url: '/retros/retro-1',
                        mood: 7.2,
                        moodVoters: 4,
                        roti: 4.1,
                        rotiVoters: 4,
                    },
                ]}
            />,
        );

        expect(
            container.querySelectorAll(
                '[data-slot="team-mood"] [data-slot="mood-trend-point"]',
            ),
        ).toHaveLength(1);
        expect(
            screen.getByRole('button', { name: 'View as table' }),
        ).toBeTruthy();
    });
});
