import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { surveyResultsSnapshot } from '@/test/survey-results';
import { ResultsState, resultsStateOf } from './results-states';

describe('resultsStateOf', () => {
    it('reads the summary when the results are there', () => {
        expect(resultsStateOf(surveyResultsSnapshot())).toBe('summary');
    });

    it('reads the threshold when too few people have answered', () => {
        expect(
            resultsStateOf(
                surveyResultsSnapshot({
                    results: {
                        belowThreshold: true,
                        responses: 2,
                        questions: {},
                    },
                }),
            ),
        ).toBe('belowThreshold');
    });

    it('reads an empty survey when the threshold is passed with no answer', () => {
        expect(
            resultsStateOf(
                surveyResultsSnapshot({
                    survey: { resultsThreshold: 0 },
                    results: {
                        belowThreshold: false,
                        responses: 0,
                        questions: {},
                    },
                }),
            ),
        ).toBe('empty');
    });

    it('waits for the closing when results show only then', () => {
        expect(
            resultsStateOf(
                surveyResultsSnapshot({
                    me: { canSeeResults: false, isEditor: false },
                    results: null,
                }),
            ),
        ).toBe('afterClose');
    });

    it('asks for an answer when results show after answering', () => {
        expect(
            resultsStateOf(
                surveyResultsSnapshot({
                    survey: { showResultsAfterAnswer: true },
                    me: {
                        canSeeResults: false,
                        isEditor: false,
                        hasSubmitted: false,
                    },
                    results: null,
                }),
            ),
        ).toBe('answerFirst');
    });

    it('waits for the closing for an observer, who cannot answer', () => {
        expect(
            resultsStateOf({
                ...surveyResultsSnapshot({
                    survey: { showResultsAfterAnswer: true },
                    me: {
                        canSeeResults: false,
                        isEditor: false,
                        hasSubmitted: false,
                    },
                    results: null,
                }),
                viewerIsObserver: true,
            }),
        ).toBe('afterClose');
    });

    it('loads while results the viewer may see have not arrived', () => {
        expect(resultsStateOf(surveyResultsSnapshot({ results: null }))).toBe(
            'loading',
        );
    });
});

describe('ResultsState', () => {
    it('gives the threshold and the answers so far, with their progress', () => {
        renderWithProviders(
            <ResultsState
                snapshot={surveyResultsSnapshot({
                    results: {
                        belowThreshold: true,
                        responses: 2,
                        questions: {},
                    },
                })}
            />,
        );

        const status = screen.getByRole('status');

        expect(status.textContent).toContain('Results appear from 3 answers');
        expect(status.textContent).toContain('2 so far · 1 more to go');
        expect(
            within(status)
                .getByRole('progressbar')
                .getAttribute('aria-valuenow'),
        ).toBe('2');
    });

    it('centres the waiting state with its bar and count together', () => {
        renderWithProviders(
            <ResultsState
                snapshot={surveyResultsSnapshot({
                    results: {
                        belowThreshold: true,
                        responses: 1,
                        questions: {},
                    },
                })}
            />,
        );

        const status = screen.getByRole('status');
        const bar = within(status).getByRole('progressbar', {
            name: '1 of 3 answers',
        });
        const row = within(status).getByText('1 / 3').parentElement;

        expect(status.classList.contains('items-center')).toBe(true);
        expect(status.classList.contains('text-center')).toBe(true);
        expect(row?.contains(bar)).toBe(true);
        expect(row?.classList.contains('items-center')).toBe(true);
        expect(row?.classList.contains('justify-center')).toBe(true);
        expect(
            within(status)
                .getByText('1 / 3')
                .classList.contains('tabular-nums'),
        ).toBe(true);
        expect(status.querySelector('[data-slot="progress-value"]')).toBeNull();
        expect(bar.getAttribute('aria-valuenow')).toBe('1');
        expect(bar.getAttribute('aria-valuemax')).toBe('3');
    });

    it('says how many answers are left, and none yet at zero', () => {
        const waitingWith = (responses: number) => (
            <ResultsState
                snapshot={surveyResultsSnapshot({
                    results: {
                        belowThreshold: true,
                        responses,
                        questions: {},
                    },
                })}
            />
        );

        const { rerender } = renderWithProviders(waitingWith(1));

        expect(
            screen.getByRole('heading', {
                name: 'Results appear from 3 answers',
            }),
        ).toBeTruthy();
        expect(screen.getByText('1 so far · 2 more to go')).toBeTruthy();

        rerender(waitingWith(0));

        expect(screen.getByText('No answer yet · 3 to go')).toBeTruthy();
        expect(
            screen.getByRole('progressbar', { name: '0 of 3 answers' }),
        ).toBeTruthy();
        expect(screen.getByText('0 / 3')).toBeTruthy();
    });

    it('says results show at the closing', () => {
        renderWithProviders(
            <ResultsState
                snapshot={surveyResultsSnapshot({
                    me: { canSeeResults: false, isEditor: false },
                    results: null,
                })}
            />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'Results will show when the survey is closed.',
        );
    });

    it('leads to the survey when results show after answering', () => {
        renderWithProviders(
            <ResultsState
                snapshot={surveyResultsSnapshot({
                    survey: { showResultsAfterAnswer: true },
                    me: {
                        canSeeResults: false,
                        isEditor: false,
                        hasSubmitted: false,
                    },
                    results: null,
                })}
            />,
        );

        const status = screen.getByRole('status');

        expect(status.textContent).toContain(
            'Answer the survey to see the results.',
        );
        expect(within(status).getByRole('link').getAttribute('href')).toBe(
            '/surveys/survey-1',
        );
    });

    it('shows the empty state when nobody has answered', () => {
        renderWithProviders(
            <ResultsState
                snapshot={surveyResultsSnapshot({
                    survey: { resultsThreshold: 0 },
                    progress: { responses: 0, completed: 0 },
                    results: {
                        belowThreshold: false,
                        responses: 0,
                        questions: {},
                    },
                })}
            />,
        );

        const status = screen.getByRole('status');

        expect(
            within(status).getByRole('heading', { name: 'No answers yet.' }),
        ).not.toBeNull();
    });

    it('shows skeleton cards while loading', () => {
        const { container } = renderWithProviders(
            <ResultsState
                snapshot={surveyResultsSnapshot({ results: null })}
            />,
        );

        expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
            'Loading',
        );
        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length,
        ).toBeGreaterThan(0);
    });

    it('renders nothing on a summary', () => {
        const { container } = renderWithProviders(
            <ResultsState snapshot={surveyResultsSnapshot()} />,
        );

        expect(container.innerHTML).toBe('');
    });
});
