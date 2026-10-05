import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamRotiCard } from '@/components/teams/team-roti-card';
import { renderWithProviders } from '@/test/render';
import type { TeamMoodPoint } from '@/types';

const mocks = vi.hoisted(() => ({ locale: 'en' }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: mocks.locale } }),
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
        moodVoters: 0,
        roti: null,
        rotiVoters: 0,
        ...values,
    };
}

afterEach(() => {
    mocks.locale = 'en';
});

const trend: TeamMoodPoint[] = [
    point('40', { roti: 3.2, completedAt: '2026-08-04T10:00:00+00:00' }),
    point('41', { mood: 6, moodVoters: 3 }),
    point('42', { roti: 4.1, completedAt: '2026-09-01T10:00:00+00:00' }),
];

describe('the ROTI card of a team', () => {
    it('shows a skeleton, named for assistive technology, while the trend loads', () => {
        const { container } = renderWithProviders(<TeamRotiCard />);

        expect(screen.getByRole('status').textContent).toBe('Loading chart');
        expect(
            container.querySelector('[data-slot="team-trend-loading"]'),
        ).not.toBeNull();
        expect(container.querySelector('[data-slot="roti-trend"]')).toBeNull();
    });

    it('draws one point per retro that has a ROTI, and none for a retro that only has a health score', () => {
        const { container } = renderWithProviders(
            <TeamRotiCard trend={trend} />,
        );

        expect(
            screen.getByRole('heading', { level: 2, name: 'Mood trend' }),
        ).toBeTruthy();
        expect(
            container.querySelectorAll('[data-slot="roti-trend-point"]'),
        ).toHaveLength(2);
        expect(
            container.querySelector('[data-slot="roti-trend-bubble"]')
                ?.textContent,
        ).toBe('4.1 / 5');
    });

    it('labels the points with their sprint when every point has one, and the badge "since" the first sprint', () => {
        const { container } = renderWithProviders(
            <TeamRotiCard
                trend={[
                    { ...trend[0], sprintLabel: 'S40' },
                    trend[1],
                    { ...trend[2], sprintLabel: 'S42' },
                ]}
            />,
        );
        const labels = Array.from(
            container.querySelectorAll('[data-slot="roti-trend-label"]'),
        ).map((label) => label.textContent);

        expect(labels).toEqual(['S40', 'S42']);
        expect(
            container.querySelector('[data-slot="roti-trend-delta"]')
                ?.textContent,
        ).toBe('+0.9 since S40');
    });

    it('labels the points with the day the retro closed when one of them has no sprint', () => {
        const { container } = renderWithProviders(
            <TeamRotiCard
                trend={[
                    { ...trend[0], sprintLabel: 'S40' },
                    { ...trend[2], sprintLabel: null },
                ]}
            />,
        );
        const labels = Array.from(
            container.querySelectorAll('[data-slot="roti-trend-label"]'),
        ).map((label) => label.textContent);

        expect(labels).toEqual(['Aug 4', 'Sep 1']);
    });

    it('labels the days in the locale of the page', () => {
        mocks.locale = 'fr';

        const { container } = renderWithProviders(
            <TeamRotiCard
                trend={[
                    { ...trend[0], sprintLabel: null },
                    { ...trend[2], sprintLabel: null },
                ]}
            />,
        );

        expect(
            container.querySelector('[data-slot="roti-trend-label"]')
                ?.textContent,
        ).toBe('4 août');
    });

    it('says so for a team without a ROTI', () => {
        const { container } = renderWithProviders(
            <TeamRotiCard trend={[trend[1]]} />,
        );

        expect(
            container.querySelector('[data-slot="roti-trend-empty"]')
                ?.textContent,
        ).toBe('No ROTI results yet.');
    });

    it('says the trend could not be loaded and offers to try again', async () => {
        const onRetry = vi.fn();

        renderWithProviders(<TeamRotiCard failed onRetry={onRetry} />);

        expect(screen.getByRole('alert').textContent).toBe(
            'The trend could not be loaded.',
        );

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledOnce();
    });
});
