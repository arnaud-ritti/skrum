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
            enps={null}
            healthHref="/w/nordlys/teams/team-1/health-check"
            enpsHref="/w/nordlys/teams/team-1/enps"
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

    it('draws the ROTI in the colour of its score', () => {
        const { container } = pulse();

        expect(
            container
                .querySelector(
                    '[data-slot="team-pulse-roti"] [data-slot="roti-value"]',
                )
                ?.getAttribute('data-step'),
        ).toBe('4');
    });

    it('colours the health score by its step', () => {
        const step = (container: HTMLElement) =>
            container
                .querySelector(
                    '[data-slot="team-pulse-health"] [data-slot="roti-value"]',
                )
                ?.getAttribute('data-step');
        const { container, unmount } = pulse({
            health: { score: 2.8, change: null },
        });

        expect(step(container)).toBe('3');
        expect(text(container, 'team-pulse-health')).toBe(
            'Health check2.8 / 5',
        );

        unmount();

        expect(
            step(pulse({ health: { score: 4.2, change: null } }).container),
        ).toBe('4');
    });

    it('colours the eNPS by its side, and not at zero', () => {
        const value = (score: number) => {
            const { container, unmount } = pulse({
                enps: { score, change: null },
            });
            const drawn = container.querySelector<HTMLElement>(
                '[data-slot="team-pulse-enps"] [data-slot="enps-value"]',
            );
            const result = {
                text: text(container, 'team-pulse-enps'),
                side: drawn?.getAttribute('data-side'),
                classes: drawn?.className ?? '',
            };

            unmount();

            return result;
        };

        expect(value(-10)).toMatchObject({
            text: 'eNPS−10',
            side: 'detractors',
        });
        expect(value(-10).classes).toContain('bg-destructive');
        expect(value(32)).toMatchObject({ text: 'eNPS+32', side: 'promoters' });
        expect(value(32).classes).toContain('bg-skrum-success');
        expect(value(0)).toMatchObject({ text: 'eNPS0', side: undefined });
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
            '/w/nordlys/teams/team-1/enps',
        ]);
    });

    it('shows the latest eNPS with its sign and change, linked to the tab', () => {
        const { container, unmount } = pulse({
            enps: { score: 32, change: 12 },
        });

        expect(text(container, 'team-pulse-enps')).toBe('eNPS+32');
        expect(text(container, 'team-pulse-enps-change')).toBe(
            '+12 since the last one',
        );
        expect(
            container
                .querySelector('[data-slot="team-pulse-enps"]')
                ?.closest('a')
                ?.getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/enps');

        unmount();

        const down = pulse({ enps: { score: -10, change: -4 } }).container;

        expect(text(down, 'team-pulse-enps')).toBe('eNPS−10');
        expect(text(down, 'team-pulse-enps-change')).toBe(
            '−4 since the last one',
        );
    });

    it('says eNPS has not run yet', () => {
        const { container, unmount } = pulse();

        expect(text(container, 'team-pulse-enps')).toBe('eNPSNot run yet');
        expect(
            container.querySelector('[data-slot="team-pulse-enps-change"]'),
        ).toBeNull();

        unmount();

        expect(
            pulse({ enps: undefined }).container.querySelector(
                '[data-slot="team-pulse-enps"]',
            ),
        ).toBeNull();
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
