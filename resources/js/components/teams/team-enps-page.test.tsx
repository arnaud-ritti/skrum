import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamEnpsPage } from '@/components/teams/team-enps-page';
import type {
    EnpsPoint,
    TeamEnpsPageProps,
} from '@/components/teams/team-enps-page';
import { renderWithProviders } from '@/test/render';

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

const october: EnpsPoint = {
    id: 'survey-2',
    title: 'eNPS October',
    url: '/surveys/survey-2/results',
    closedOn: '2026-10-05',
    answers: 9,
    score: 33,
    change: 13,
    promoters: 5,
    passives: 2,
    detractors: 2,
};

const september: EnpsPoint = {
    id: 'survey-1',
    title: 'eNPS September',
    url: '/surveys/survey-1/results',
    closedOn: '2026-09-04',
    answers: 5,
    score: -20,
    change: null,
    promoters: 1,
    passives: 2,
    detractors: 2,
};

const startUrl = '/w/nordlys/teams/team-1?new=survey&template=enps';

function page(props: Partial<TeamEnpsPageProps> = {}) {
    return renderWithProviders(
        <TeamEnpsPage
            enps={{ latest: october, history: [october, september] }}
            canStart
            startUrl={startUrl}
            {...props}
        />,
    );
}

const text = (container: HTMLElement, slot: string) =>
    container.querySelector(`[data-slot="${slot}"]`)?.textContent;

describe('the eNPS tab of Insights', () => {
    it('shows the latest score with its sign, its change and the three counts', () => {
        const { container } = page();
        const latest = screen.getByRole('region', { name: 'Latest eNPS' });

        expect(text(container, 'enps-score')).toBe('+33');
        expect(text(container, 'enps-change')).toBe('+13 since the last one');
        expect(text(container, 'enps-latest-survey')).toBe(
            'eNPS October · Oct 5, 2026 · 9 answers',
        );
        expect(
            within(latest)
                .getByRole('link', { name: 'eNPS October' })
                .getAttribute('href'),
        ).toBe('/surveys/survey-2/results');
        expect(
            within(latest).getByRole('img', {
                name: '2 detractors, 2 passives, 5 promoters',
            }),
        ).toBeTruthy();
        expect(
            Array.from(latest.querySelectorAll('dd')).map(
                (count) => count.textContent,
            ),
        ).toEqual(['2', '2', '5']);
    });

    it('shows no change for a first survey', () => {
        const { container } = page({
            enps: { latest: september, history: [september] },
        });

        expect(text(container, 'enps-score')).toBe('−20');
        expect(container.querySelector('[data-slot="enps-change"]')).toBeNull();
    });

    it('lists the history, each line to its results', () => {
        page();

        const lines = within(
            screen.getByRole('region', { name: 'History' }),
        ).getAllByRole('link');

        expect(
            lines.map((line) => [
                line.getAttribute('href'),
                Array.from(line.querySelectorAll('[data-slot^="enps-line"]'))
                    .map((part) => part.textContent)
                    .join(' | '),
            ]),
        ).toEqual([
            [
                '/surveys/survey-2/results',
                'eNPS October | Oct 5, 2026 | 9 answers | +33',
            ],
            [
                '/surveys/survey-1/results',
                'eNPS September | Sep 4, 2026 | 5 answers | −20',
            ],
        ]);
        expect(
            lines.map((line) =>
                within(line).getByRole('img').getAttribute('aria-label'),
            ),
        ).toEqual([
            '2 detractors, 2 passives, 5 promoters',
            '2 detractors, 2 passives, 1 promoters',
        ]);
        expect(lines[0].querySelector('dl')).toBeNull();
    });

    it('offers Start an eNPS survey only to who may', () => {
        const { unmount } = page();

        expect(
            screen
                .getByRole('link', { name: 'Start an eNPS survey' })
                .getAttribute('href'),
        ).toBe(startUrl);

        unmount();
        page({ canStart: false });

        expect(
            screen.queryByRole('link', { name: 'Start an eNPS survey' }),
        ).toBeNull();
    });

    it('says no eNPS survey has closed yet', () => {
        const { container, unmount } = page({
            enps: { latest: null, history: [] },
        });

        expect(text(container, 'empty-state-title')).toBe(
            'No eNPS survey has closed yet.',
        );
        expect(
            screen
                .getByRole('link', { name: 'Start an eNPS survey' })
                .getAttribute('href'),
        ).toBe(startUrl);
        expect(screen.queryByRole('region', { name: 'History' })).toBeNull();

        unmount();
        page({ enps: { latest: null, history: [] }, canStart: false });

        expect(screen.queryByRole('link')).toBeNull();
    });
});
