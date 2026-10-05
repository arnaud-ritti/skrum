import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TeamPulseCard } from '@/components/teams/team-pulse-card';
import { renderWithProviders } from '@/test/render';
import type { TeamMoodPoint } from '@/types';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
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
}));

function point(
    retroId: string,
    values: Partial<TeamMoodPoint> = {},
): TeamMoodPoint {
    return {
        retroId,
        surveyId: null,
        title: `Sprint ${retroId}`,
        completedAt: '2026-09-01T10:00:00+00:00',
        url: `/retros/${retroId}`,
        mood: null,
        moodQ1: null,
        moodQ3: null,
        moodVoters: 0,
        roti: null,
        rotiVoters: 0,
        ...values,
    };
}

const trend: TeamMoodPoint[] = [
    point('40', { roti: 3.2 }),
    point('41', { roti: 3.5 }),
    point('42', { mood: 6, moodVoters: 3 }),
    point('43', { roti: 4 }),
];

function pulse(props: Partial<Parameters<typeof TeamPulseCard>[0]> = {}) {
    return renderWithProviders(
        <TeamPulseCard
            trend={trend}
            healthScore={null}
            insightsHref="/w/nordlys/teams/team-1/insights"
            {...props}
        />,
    );
}

const text = (container: HTMLElement, slot: string) =>
    container.querySelector(`[data-slot="${slot}"]`)?.textContent;

describe('the team pulse', () => {
    it('shows the latest average ROTI and its change since the retro before', () => {
        const { container } = pulse();

        expect(
            screen.getByRole('heading', { level: 2, name: 'Team pulse' }),
        ).toBeTruthy();
        expect(text(container, 'team-pulse-roti')).toBe('Average ROTI4.0 / 5');
        expect(text(container, 'team-pulse-delta')).toBe(
            '+0.5 since the previous retro',
        );
    });

    it('shows a ROTI that went down as such', () => {
        const { container } = pulse({
            trend: [point('40', { roti: 4.1 }), point('41', { roti: 3.8 })],
        });

        expect(text(container, 'team-pulse-delta')).toBe(
            '−0.3 since the previous retro',
        );
    });

    it('shows no change after a single retro, and says when no retro has a ROTI', () => {
        const { container, unmount } = pulse({ trend: trend.slice(0, 1) });

        expect(text(container, 'team-pulse-roti')).toBe('Average ROTI3.2 / 5');
        expect(
            container.querySelector('[data-slot="team-pulse-delta"]'),
        ).toBeNull();

        unmount();
        pulse({ trend: [] });

        expect(screen.getByText('No ROTI results yet.')).toBeTruthy();
    });

    it('shows the health score, or that no health check ran', () => {
        const { container, unmount } = pulse({ healthScore: 3.8 });

        expect(text(container, 'team-pulse-health')).toBe(
            'Health check: 3.8 / 5',
        );

        unmount();

        expect(text(pulse().container, 'team-pulse-health')).toBe(
            'Health check: not run yet',
        );
    });

    it('says nothing of the health check while its score has not arrived', () => {
        const { container } = pulse({ healthScore: undefined });

        expect(
            container.querySelector('[data-slot="team-pulse-health"]'),
        ).toBeNull();
    });

    it('leads to Insights', () => {
        pulse();

        expect(
            screen.getByRole('link', { name: 'Insights' }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/insights');
    });

    it('shows a skeleton until the trend arrives, and offers to retry a trend that could not be built', async () => {
        const onRetry = vi.fn();
        const { container, unmount } = pulse({ trend: undefined });

        expect(
            container.querySelector('[data-slot="team-trend-loading"]'),
        ).not.toBeNull();
        expect(container.querySelector('[data-slot="team-pulse"]')).toBeNull();

        unmount();
        pulse({ trend: undefined, failed: true, onRetry });

        expect(screen.getByRole('alert').textContent).toBe(
            'The trend could not be loaded.',
        );
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledOnce();
    });
});
