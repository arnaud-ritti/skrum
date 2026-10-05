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
    point('40', { roti: 3.8, rotiVoters: 4 }),
    point('41', { mood: 3, moodVoters: 3, roti: 4.3, rotiVoters: 3 }),
    point('42', { mood: 3.5, moodVoters: 4, roti: 4, rotiVoters: 5 }),
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
                '[data-slot="team-trend-loading"] [data-slot="skeleton"]',
            ).length,
        ).toBeGreaterThan(0);
        expect(
            container.querySelector('[data-slot="mood-trend-chart"]'),
        ).toBeNull();
    });

    it('draws one point per retro with a health score, on 5, with the change since the previous retro, and no ROTI tab', () => {
        const { container } = renderWithProviders(
            <TeamMoodCard trend={trend} />,
        );

        expect(
            screen.getByRole('heading', { level: 2, name: 'Mood trend' }),
        ).toBeTruthy();
        expect(screen.queryByRole('tab', { name: 'Mood' })).toBeNull();
        expect(screen.queryByRole('tab', { name: 'ROTI' })).toBeNull();
        expect(dots(container)).toHaveLength(2);
        expect(
            container.querySelector('[data-slot="mood-trend-kpi"]')
                ?.textContent,
        ).toBe('3.5/5');
        expect(
            container.querySelector('[data-slot="mood-trend-delta"]')
                ?.textContent,
        ).toBe('+0.5 since the previous retro');
    });

    it('draws the spread of the mood from Q1 to Q3 and the threshold of 3, on an axis from 1 to 5', () => {
        const { container } = renderWithProviders(
            <TeamMoodCard
                trend={[
                    point('40', { mood: 2.8, moodQ1: 2.2, moodQ3: 3.4 }),
                    point('41', { mood: 3, moodQ1: 2.5, moodQ3: 3.5 }),
                    point('42', { mood: 3.5, moodQ1: 3, moodQ3: 4 }),
                ]}
            />,
        );

        expect(
            container.querySelector('[data-slot="mood-trend-band"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-slot="mood-trend-threshold"]')
                ?.textContent,
        ).toBe('3 · okay');
        expect(
            Array.from(
                container.querySelectorAll('[data-slot="mood-trend-level"]'),
            ).map((level) => level.textContent),
        ).toEqual(['1', '2', '3', '4', '5']);
    });

    it('lists the same values in the table view, each retro or survey as a link, with its kind', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <TeamMoodCard
                trend={[
                    ...trend,
                    point('43', {
                        retroId: null,
                        surveyId: 's43',
                        title: 'Pulse 43',
                        url: '/surveys/s43/results',
                        mood: 4,
                        moodQ1: null,
                        moodQ3: null,
                        moodVoters: 6,
                    }),
                ]}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'View as table' }));

        const rows = within(screen.getByRole('table')).getAllByRole('row');

        expect(rows.map((row) => row.textContent)).toEqual([
            'RetroKindHealth scoreVoters',
            'Sprint 41Retro3.0/53',
            'Sprint 42Retro3.5/54',
            'Pulse 43Survey4.0/56',
        ]);
        expect(
            screen
                .getByRole('link', { name: 'Sprint 42' })
                .getAttribute('href'),
        ).toBe('/retros/42');
        expect(
            screen.getByRole('link', { name: 'Pulse 43' }).getAttribute('href'),
        ).toBe('/surveys/s43/results');
    });

    it('says so for a team without a health score, even when it has ROTI votes', () => {
        const { container } = renderWithProviders(
            <TeamMoodCard trend={[trend[0]]} />,
        );

        expect(
            container.querySelector('[data-slot="mood-trend-empty"]')
                ?.textContent,
        ).toBe('No health check results yet.');
        expect(
            container.querySelector('[data-slot="mood-trend-kpi"]'),
        ).toBeNull();
    });

    it('says the trend could not be loaded and offers to try again', async () => {
        const onRetry = vi.fn();
        const { container } = renderWithProviders(
            <TeamMoodCard failed onRetry={onRetry} />,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'The trend could not be loaded.',
        );
        expect(
            container.querySelector('[data-slot="mood-trend-chart"]'),
        ).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledOnce();
    });
});
