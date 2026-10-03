import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SurveyClosed } from '@/components/surveys/survey-closed';
import { renderWithProviders } from '@/test/render';

describe('SurveyClosed', () => {
    it('says the survey is closed, since when, and leads to the results', () => {
        renderWithProviders(
            <SurveyClosed
                closedAt="2026-10-03T16:00:00.000Z"
                resultsHref="/surveys/s1/results"
            />,
        );

        expect(screen.getByText('This survey is closed.')).toBeTruthy();
        expect(screen.getByText(/^Closed on /)).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'See the results' })
                .getAttribute('href'),
        ).toBe('/surveys/s1/results');
    });

    it('gives no date it does not have', () => {
        renderWithProviders(
            <SurveyClosed closedAt={null} resultsHref="/surveys/s1/results" />,
        );

        expect(screen.queryByText(/^Closed on /)).toBeNull();
    });
});
