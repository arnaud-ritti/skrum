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
            health={null}
            insightsHref="/w/nordlys/teams/team-1/insights"
            healthHref="/w/nordlys/teams/team-1/health-check"
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

        expect(text(pulse({ trend: [] }).container, 'team-pulse-roti')).toBe(
            'Average ROTINo retro yet',
        );
    });

    it('draws the ROTI in the colour of its score, and the health score in the text colour', () => {
        const { container } = pulse({ health: { score: 2.8, change: null } });
        const value = '[data-slot="roti-value"]';

        expect(
            container
                .querySelector(`[data-slot="team-pulse-roti"] ${value}`)
                ?.getAttribute('data-step'),
        ).toBe('4');
        expect(
            container.querySelector(`[data-slot="team-pulse-health"] ${value}`),
        ).toBeNull();
    });

    it('shows the health check as a figure with its change, like ROTI', () => {
        const { container, unmount } = pulse({
            health: { score: 2.8, change: -0.4 },
        });

        expect(text(container, 'team-pulse-health')).toBe(
            'Health check2.8 / 5',
        );
        expect(text(container, 'team-pulse-health-change')).toBe(
            '−0.4 since the previous one',
        );

        unmount();

        const first = pulse({ health: { score: 3.8, change: null } }).container;

        expect(text(first, 'team-pulse-health')).toBe('Health check3.8 / 5');
        expect(
            first.querySelector('[data-slot="team-pulse-health-change"]'),
        ).toBeNull();
    });

    it('says Not run yet in the place of a figure without data', () => {
        const { container } = pulse();

        expect(text(container, 'team-pulse-health')).toBe(
            'Health checkNot run yet',
        );
        expect(
            container.querySelector('[data-slot="team-pulse-health-change"]'),
        ).toBeNull();
    });

    it('links each figure to its Insights tab', () => {
        const { container } = pulse();

        expect(
            Array.from(
                container.querySelectorAll('a[data-slot="pulse-figure"]'),
            ).map((figure) => figure.getAttribute('href')),
        ).toEqual([
            '/w/nordlys/teams/team-1/insights',
            '/w/nordlys/teams/team-1/health-check',
        ]);
    });

    it('says nothing of the health check while its score has not arrived', () => {
        const { container } = pulse({ health: undefined });

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
