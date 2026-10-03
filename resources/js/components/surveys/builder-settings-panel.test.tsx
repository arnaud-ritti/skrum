import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderSettingsPanel } from '@/components/surveys/builder-settings-panel';
import { renderWithProviders } from '@/test/render';

const settings = {
    oneQuestionAtATime: true,
    showResultsAfterAnswer: false,
    guestAccessEnabled: false,
};

describe('BuilderSettingsPanel', () => {
    it('says answers are anonymous and shows the three switches', () => {
        renderWithProviders(
            <BuilderSettingsPanel settings={settings} onChange={vi.fn()} />,
        );

        expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
        expect(screen.getByText('Answers are anonymous')).toBeTruthy();
        expect(
            screen
                .getByRole('switch', { name: 'One question at a time' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByText('Recommended on a phone')).toBeTruthy();
        expect(
            screen
                .getByRole('switch', { name: 'Show results after answering' })
                .getAttribute('aria-checked'),
        ).toBe('false');
        expect(
            screen.getByRole('switch', {
                name: 'Allow guests without an account',
            }).id,
        ).toBe('survey-guests');
    });

    it('saves each switch at once with its field', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <BuilderSettingsPanel settings={settings} onChange={onChange} />,
        );

        fireEvent.click(document.getElementById('survey-one-at-a-time')!);
        fireEvent.click(document.getElementById('survey-results-after')!);
        fireEvent.click(document.getElementById('survey-guests')!);

        expect(onChange.mock.calls).toEqual([
            [{ one_question_at_a_time: false }],
            [{ show_results_after_answer: true }],
            [{ guest_access_enabled: true }],
        ]);
    });
});
