import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TeamMoodCard } from '@/components/teams/team-mood-card';
import { renderWithProviders } from '@/test/render';
import type { TeamMoodPoint } from '@/types';

const mocks = vi.hoisted(() => ({
    props: { translations: {}, locale: 'en' },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string;
            children?: React.ReactNode;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

function point(
    retroId: string,
    values: Partial<TeamMoodPoint> = {},
): TeamMoodPoint {
    return {
        retroId,
        title: `Sprint ${retroId}`,
        completedAt: '2026-09-01T10:00:00+00:00',
        url: `/retros/${retroId}`,
        mood: null,
        moodVoters: 0,
        roti: null,
        rotiVoters: 0,
        ...values,
    };
}

const trend: TeamMoodPoint[] = [
    point('40', { roti: 3.8, rotiVoters: 4 }),
    point('41', { mood: 6, moodVoters: 3, roti: 4.3, rotiVoters: 3 }),
    point('42', { mood: 7.5, moodVoters: 4, roti: 4, rotiVoters: 5 }),
];

function dots(container: HTMLElement) {
    return container.querySelectorAll('[data-slot="mood-trend-point"]');
}

describe('the mood card of a team', () => {
    it('shows a pulsing skeleton, named for assistive technology, while the trend loads', () => {
        const { container } = renderWithProviders(<TeamMoodCard />);

        expect(screen.getByRole('status').textContent).toBe('Loading chart');
        expect(
            container.querySelectorAll(
                '[data-slot="team-mood-loading"] [data-slot="skeleton"]',
            ).length,
        ).toBeGreaterThan(0);
        expect(
            container.querySelector('[data-slot="mood-trend-chart"]'),
        ).toBeNull();
    });

    it('draws the mood first: one point per retro with a health score, on 10, with the change since the previous retro', () => {
        const { container } = renderWithProviders(
            <TeamMoodCard trend={trend} />,
        );

        expect(
            screen.getByRole('heading', { level: 2, name: 'Mood trend' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('tab', { name: 'Mood' })
                .getAttribute('aria-selected'),
        ).toBe('true');
        expect(dots(container)).toHaveLength(2);
        expect(
            container.querySelector('[data-slot="mood-trend-kpi"]')
                ?.textContent,
        ).toBe('7.5/10');
        expect(
            container.querySelector('[data-slot="mood-trend-delta"]')
                ?.textContent,
        ).toBe('+1.5 since the previous retro');
    });

    it('draws the ROTI averages on the ROTI tab, on the scale of the ROTI', async () => {
        const user = userEvent.setup();
        const { container } = renderWithProviders(
            <TeamMoodCard trend={trend} />,
        );

        await user.click(screen.getByRole('tab', { name: 'ROTI' }));

        expect(dots(container)).toHaveLength(3);
        expect(
            container.querySelector('[data-slot="mood-trend-kpi"]')
                ?.textContent,
        ).toBe('4.0');
        expect(
            container.querySelector('[data-slot="mood-trend-delta"]')
                ?.textContent,
        ).toBe('−0.3 since the previous retro');
        expect(
            container.querySelector('[data-slot="mood-trend-threshold"]'),
        ).not.toBeNull();
    });

    it('lists the same values in the table view, each retro as a link', async () => {
        const user = userEvent.setup();

        renderWithProviders(<TeamMoodCard trend={trend} />);

        await user.click(screen.getByRole('button', { name: 'View as table' }));

        const rows = within(screen.getByRole('table')).getAllByRole('row');

        expect(rows.map((row) => row.textContent)).toEqual([
            'RetroHealth scoreVoters',
            'Sprint 416.0/103',
            'Sprint 427.5/104',
        ]);
        expect(
            screen
                .getByRole('link', { name: 'Sprint 42' })
                .getAttribute('href'),
        ).toBe('/retros/42');

        await user.click(screen.getByRole('tab', { name: 'ROTI' }));

        expect(
            within(screen.getByRole('table'))
                .getAllByRole('row')
                .map((row) => row.textContent),
        ).toEqual([
            'RetroAverage ROTIVoters',
            'Sprint 403.84',
            'Sprint 414.33',
            'Sprint 424.05',
        ]);
    });

    it('opens on the ROTI when no retro has a health score', () => {
        const { container } = renderWithProviders(
            <TeamMoodCard trend={[trend[0]]} />,
        );

        expect(
            screen
                .getByRole('tab', { name: 'ROTI' })
                .getAttribute('aria-selected'),
        ).toBe('true');
        expect(dots(container)).toHaveLength(1);
        expect(
            container.querySelector('[data-slot="mood-trend-delta"]'),
        ).toBeNull();
    });

    it('says so on each tab for a team without data', async () => {
        const user = userEvent.setup();
        const { container } = renderWithProviders(<TeamMoodCard trend={[]} />);

        expect(
            container.querySelector('[data-slot="mood-trend-empty"]')
                ?.textContent,
        ).toBe('No health check results yet.');
        expect(
            container.querySelector('[data-slot="mood-trend-kpi"]'),
        ).toBeNull();

        await user.click(screen.getByRole('tab', { name: 'ROTI' }));

        expect(
            container.querySelector('[data-slot="mood-trend-empty"]')
                ?.textContent,
        ).toBe('No ROTI results yet.');
    });

    it('keeps the chart, not the skeleton, while the trend is fetched again', () => {
        const { container, rerender } = renderWithProviders(
            <TeamMoodCard trend={trend} />,
        );

        rerender(<TeamMoodCard />);

        expect(
            container.querySelector('[data-slot="team-mood-loading"]'),
        ).toBeNull();
        expect(dots(container)).toHaveLength(2);

        rerender(<TeamMoodCard trend={[trend[2]]} />);

        expect(dots(container)).toHaveLength(1);
    });
});
