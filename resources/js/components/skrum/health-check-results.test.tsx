import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthCheckResults } from '@/components/skrum/health-check-results';
import type { HealthCheckResult } from '@/components/skrum/health-check-results';
import { renderWithProviders } from '@/test/render';

const results: HealthCheckResult[] = [
    {
        statementId: 'a',
        label: 'Interaction',
        distribution: [0, 0, 2, 4, 2],
        mean: 4,
        previousMean: 3.7,
    },
    {
        statementId: 'b',
        label: 'Manager support',
        distribution: [0, 0, 1, 3, 4],
        mean: 4.4,
        previousMean: 4.4,
    },
    {
        statementId: 'c',
        label: 'Processes',
        distribution: [2, 3, 2, 1, 0],
        mean: 2.2,
        previousMean: 2.8,
    },
    {
        statementId: 'd',
        label: 'Vision',
        distribution: [0, 2, 3, 2, 1],
        mean: 3.2,
    },
];

function show(props: Partial<Parameters<typeof HealthCheckResults>[0]> = {}) {
    renderWithProviders(
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
    it('shows mean, written trend and an accessible distribution', () => {
        show();

        const interaction = row('Interaction');
        expect(within(interaction).getByText('4.0')).toBeTruthy();
        expect(
            interaction.querySelector('[data-trend="up"]')?.textContent,
        ).toContain('+0.3');
        expect(
            interaction.querySelector('[data-trend="up"]')?.textContent,
        ).toContain('vs sprint 41');
        expect(
            within(interaction).getByRole('img').getAttribute('aria-label'),
        ).toBe('1 : 0 · 2 : 0 · 3 : 2 · 4 : 4 · 5 : 2');
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
        show({ alertThreshold: 4.5 });

        expect(screen.getAllByText('Needs attention')).toHaveLength(4);
    });

    it('hides the trend without a previous mean', () => {
        show();

        expect(
            row('Vision').querySelector('[data-slot="health-trend"]'),
        ).toBeNull();
    });

    it('hides the results below three respondents', () => {
        show({ respondents: 2 });

        expect(screen.getByRole('status').textContent).toBe(
            'Not enough answers to show results',
        );
        expect(screen.queryByText('Interaction')).toBeNull();
    });

    it('reveals results at exactly three respondents', () => {
        show({ respondents: 3 });

        expect(screen.getByText('Interaction')).toBeTruthy();
    });
});
