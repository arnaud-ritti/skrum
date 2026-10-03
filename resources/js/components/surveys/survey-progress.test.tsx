import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SurveyProgress } from '@/components/surveys/survey-progress';
import { renderWithProviders } from '@/test/render';

describe('SurveyProgress', () => {
    it('draws one hidden segment per question up to twelve, the text carrying the step', () => {
        const { container } = renderWithProviders(
            <SurveyProgress index={1} count={5} />,
        );
        const segments = container.querySelector(
            '[data-slot="survey-progress-segments"]',
        );

        expect(screen.getByText('Question 2 of 5')).toBeTruthy();
        expect(segments?.getAttribute('aria-hidden')).toBe('true');
        expect(segments?.children).toHaveLength(5);
        expect(segments?.children[0].getAttribute('data-state')).toBe('done');
        expect(segments?.children[1].getAttribute('data-state')).toBe(
            'current',
        );
        expect(segments?.children[2].getAttribute('data-state')).toBe('todo');
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('turns into a progress bar with the percentage above twelve questions', () => {
        const { container } = renderWithProviders(
            <SurveyProgress index={2} count={16} />,
        );

        expect(screen.getByText('Question 3 of 16')).toBeTruthy();
        expect(screen.getByRole('progressbar')).toBeTruthy();
        expect(screen.getByText('19%')).toBeTruthy();
        expect(
            container.querySelector('[data-slot="survey-progress-segments"]'),
        ).toBeNull();
    });
});
