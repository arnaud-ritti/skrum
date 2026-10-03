import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurveyThanks } from '@/components/surveys/survey-thanks';
import { renderWithProviders } from '@/test/render';
import { surveyQuestion, surveySnapshot } from '@/test/survey-snapshot';

describe('SurveyThanks', () => {
    it('thanks the viewer, gives the count, and offers to change the answers while open', () => {
        const onChangeAnswers = vi.fn();

        renderWithProviders(
            <SurveyThanks
                snapshot={surveySnapshot({ me: { hasSubmitted: true } })}
                onChangeAnswers={onChangeAnswers}
            />,
        );

        expect(
            screen.getByRole('heading', {
                name: 'Thank you — your answers are saved.',
            }),
        ).toBeTruthy();
        expect(screen.getByText('3 of 11 have answered')).toBeTruthy();
        expect(
            screen.getByText('Results will show when the survey is closed.'),
        ).toBeTruthy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Change my answers' }),
        );

        expect(onChangeAnswers).toHaveBeenCalledTimes(1);
    });

    it('shows the results when the viewer may see them', () => {
        renderWithProviders(
            <SurveyThanks
                snapshot={surveySnapshot({
                    me: { hasSubmitted: true, canSeeResults: true },
                    questions: [
                        surveyQuestion('a', 'scale', { label: 'Mood' }),
                    ],
                    results: {
                        belowThreshold: false,
                        responses: 4,
                        questions: {
                            a: {
                                responses: 4,
                                mean: 3.5,
                                mode: 4,
                                buckets: [],
                            },
                        },
                    },
                })}
                onChangeAnswers={() => {}}
            />,
        );

        expect(
            screen.queryByText('Results will show when the survey is closed.'),
        ).toBeNull();
        expect(screen.getByRole('article', { name: 'Mood' })).toBeTruthy();
        expect(screen.getByText('4 responses')).toBeTruthy();
    });

    it('says how many answers the results wait for, below the threshold', () => {
        renderWithProviders(
            <SurveyThanks
                snapshot={surveySnapshot({
                    me: { hasSubmitted: true, canSeeResults: true },
                    results: {
                        belowThreshold: true,
                        responses: 2,
                        questions: {},
                    },
                })}
                onChangeAnswers={() => {}}
            />,
        );

        expect(
            screen.getByText('Results appear from 3 answers. 2 so far.'),
        ).toBeTruthy();
        expect(screen.queryByRole('article')).toBeNull();
    });
});
