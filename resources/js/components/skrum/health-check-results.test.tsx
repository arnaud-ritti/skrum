import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    healthCheckMinimumRespondents,
    HealthCheckResults,
} from '@/components/skrum/health-check-results';
import type { HealthCheckResult } from '@/components/skrum/health-check-results';
import { renderWithProviders } from '@/test/render';

const results: HealthCheckResult[] = [
    {
        key: 'a',
        label: 'Interaction',
        distribution: [0, 0, 0, 0, 0, 1, 1, 4, 1, 1],
        average: 8,
        previousAverage: 7.7,
    },
    {
        key: 'b',
        label: 'Manager support',
        distribution: [0, 0, 0, 0, 0, 0, 1, 3, 2, 2],
        average: 8.8,
        previousAverage: 8.8,
    },
    {
        key: 'c',
        label: 'Processes',
        distribution: [1, 1, 2, 2, 1, 1, 0, 0, 0, 0],
        average: 4.4,
        previousAverage: 5,
    },
    {
        key: 'd',
        label: 'Vision',
        distribution: [0, 0, 1, 1, 2, 2, 1, 1, 0, 0],
        average: 6.4,
    },
];

const serverResults: HealthCheckResult[] = [
    {
        key: 'interaction',
        label: 'Interaction',
        text: 'Interaction with colleagues was productive',
        average: 8.25,
        count: 8,
    },
    {
        key: 'vision',
        label: 'Vision',
        text: 'The vision and goals are clear to me',
        average: null,
        count: 0,
    },
];

function show(props: Partial<Parameters<typeof HealthCheckResults>[0]> = {}) {
    return renderWithProviders(
        <HealthCheckResults
            retroTitle="Sprint 42"
            respondents={8}
            participants={9}
            previousRetroTitle="sprint 41"
            results={results}
            {...props}
        />,
    );
}

function row(label: string): HTMLElement {
    return screen.getByText(label).closest('li') as HTMLElement;
}

describe('HealthCheckResults', () => {
    it('shows the average out of 10, a written trend and an accessible distribution', () => {
        show();

        const interaction = row('Interaction');
        expect(
            interaction.querySelector('[data-slot="health-mean"]')?.textContent,
        ).toBe('8.0/10');
        expect(
            interaction.querySelector('[data-trend="up"]')?.textContent,
        ).toContain('+0.3');
        expect(
            interaction.querySelector('[data-trend="up"]')?.textContent,
        ).toContain('vs sprint 41');
        expect(
            within(interaction).getByRole('img').getAttribute('aria-label'),
        ).toBe(
            '1 : 0 · 2 : 0 · 3 : 0 · 4 : 0 · 5 : 0 · 6 : 1 · 7 : 1 · 8 : 4 · 9 : 1 · 10 : 1',
        );
        expect(screen.getByText('Alert threshold · 6/10')).toBeTruthy();
        expect(screen.getByText('1–2 · Awful')).toBeTruthy();
        expect(screen.getByText('9–10 · Great')).toBeTruthy();
    });

    it('renders the server payload: average or no answers, count, no bars', () => {
        show({ results: serverResults, previousRetroTitle: undefined });

        const interaction = row('Interaction');

        expect(
            interaction.querySelector('[data-slot="health-mean"]')?.textContent,
        ).toBe('8.3/10');
        expect(within(interaction).getByText('8 answered')).toBeTruthy();
        expect(
            within(interaction).getByText(
                'Interaction with colleagues was productive',
            ),
        ).toBeTruthy();
        expect(within(row('Vision')).getByText('No answers')).toBeTruthy();
        expect(within(row('Vision')).queryByText('Needs attention')).toBeNull();
        expect(
            document.querySelector('[data-slot="health-distribution"]'),
        ).toBeNull();
        expect(document.querySelector('[data-slot="health-trend"]')).toBeNull();
        expect(screen.queryByText(/Awful/)).toBeNull();
    });

    it('shows the summary figures, the assessment and the slot for radar and trend', () => {
        show({
            results: serverResults,
            summary: {
                score: 7.4,
                topStrength: { label: 'Interaction', average: 8.25 },
                growthArea: null,
                alignment: { value: 6, label: 'Moderate alignment' },
                assessment: {
                    title: 'Good health.',
                    sentence: 'Keep an eye on the processes.',
                },
            },
            children: <figure data-testid="radar" />,
        });

        const summary = document.querySelector(
            '[data-slot="health-summary"]',
        ) as HTMLElement;

        expect(within(summary).getByText('7.4/10')).toBeTruthy();
        expect(within(summary).getByText('Top strength')).toBeTruthy();
        expect(within(summary).getByText('8.3/10')).toBeTruthy();
        expect(within(summary).queryByText('Growth area')).toBeNull();
        expect(within(summary).getByText('6/10')).toBeTruthy();
        expect(within(summary).getByText('Moderate alignment')).toBeTruthy();
        expect(screen.getByText('Good health.')).toBeTruthy();
        expect(screen.getByTestId('radar')).toBeTruthy();
    });

    it('keeps a 1 to 5 scale when asked', () => {
        show({
            scale: 5,
            results: [
                {
                    key: 'a',
                    label: 'Interaction',
                    average: 2.2,
                    distribution: [2, 3, 2, 1, 0],
                },
            ],
        });

        expect(
            row('Interaction').querySelector('[data-slot="health-mean"]')
                ?.textContent,
        ).toBe('2.2/5');
        expect(screen.getByText('Needs attention')).toBeTruthy();
        expect(screen.getByText('Alert threshold · 3/5')).toBeTruthy();
    });

    it('shows a stable trend as text', () => {
        show();

        expect(
            row('Manager support').querySelector('[data-trend="flat"]')
                ?.textContent,
        ).toContain('no change');
    });

    it('flags statements below the threshold with icon and text', () => {
        show();

        expect(
            within(row('Processes')).getByText('Needs attention'),
        ).toBeTruthy();
        expect(
            row('Processes').querySelector('[data-trend="down"]')?.textContent,
        ).toContain('−0.6');
        expect(screen.getAllByText('Needs attention')).toHaveLength(1);
    });

    it('honours a custom alert threshold', () => {
        show({ alertThreshold: 9 });

        expect(screen.getAllByText('Needs attention')).toHaveLength(4);
    });

    it('hides the trend without a previous average', () => {
        show();

        expect(
            row('Vision').querySelector('[data-slot="health-trend"]'),
        ).toBeNull();
    });

    it('shows what the server sends whatever the number of respondents by default', () => {
        show({ respondents: 1 });

        expect(screen.getByText('Interaction')).toBeTruthy();
        expect(
            screen.queryByText('Not enough answers to show results'),
        ).toBeNull();
    });

    it('hides the results below the minimum when one is asked for', () => {
        show({
            respondents: 2,
            minimumRespondents: healthCheckMinimumRespondents,
        });

        expect(screen.getByRole('status').textContent).toBe(
            'Not enough answers to show results',
        );
        expect(screen.queryByText('Interaction')).toBeNull();
    });

    it('reveals results at exactly the minimum', () => {
        show({
            respondents: 3,
            minimumRespondents: healthCheckMinimumRespondents,
        });

        expect(screen.getByText('Interaction')).toBeTruthy();
    });

    it('handles no statement and 200 statements with 60-character labels', () => {
        const { unmount } = show({ results: [] });

        expect(screen.getByText('No statements to show.')).toBeTruthy();
        unmount();

        show({
            results: Array.from({ length: 200 }, (_, index) => ({
                key: `s${index}`,
                label: `${'L'.repeat(56)} ${index}`,
                average: (index % 10) + 1,
                count: 8,
            })),
        });

        expect(screen.getAllByRole('listitem')).toHaveLength(200);
    });
});
