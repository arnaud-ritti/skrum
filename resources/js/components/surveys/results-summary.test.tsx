import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import {
    mockupQuestions,
    mockupResults,
    surveySnapshot,
} from '@/test/survey-results';
import { ResultsSummary } from './results-summary';

function card(label: string): HTMLElement {
    return screen.getByRole('article', { name: label });
}

describe('ResultsSummary', () => {
    it('shows one card per question, named by its label', () => {
        renderWithProviders(<ResultsSummary snapshot={surveySnapshot()} />);

        expect(screen.getAllByRole('article')).toHaveLength(5);

        for (const question of mockupQuestions) {
            expect(card(question.label)).not.toBeNull();
        }
    });

    it('shows the figures of the mockup on the five kinds', () => {
        renderWithProviders(<ResultsSummary snapshot={surveySnapshot()} />);

        expect(
            within(card('Workload of the sprint')).getByText('3.8'),
        ).not.toBeNull();
        expect(
            within(card('Would you recommend the team?')).getByText('+22'),
        ).not.toBeNull();
        expect(
            within(card('Which ritual must we keep?')).getByText('5 · 56%'),
        ).not.toBeNull();
        expect(
            within(card('What slowed you down?')).getByText('6 · 67%'),
        ).not.toBeNull();
        expect(
            card('Which ritual must we keep?').querySelectorAll(
                '[data-slot="survey-result-bar"]',
            ),
        ).toHaveLength(4);
    });

    it('draws a scale as the mockup histogram with its two ends under it', () => {
        renderWithProviders(<ResultsSummary snapshot={surveySnapshot()} />);

        const scale = card('Workload of the sprint');

        expect(
            scale.querySelector('[data-slot="survey-scale-histogram"]'),
        ).not.toBeNull();
        expect(scale.querySelector('[data-slot="survey-result"]')).toBeNull();
        expect(within(scale).getByText('Unbearable')).not.toBeNull();
        expect(within(scale).getByText('Very comfortable')).not.toBeNull();
    });

    it('numbers each card out of the number of questions', () => {
        renderWithProviders(<ResultsSummary snapshot={surveySnapshot()} />);

        expect(
            within(card('Workload of the sprint')).getByText('1 / 5'),
        ).not.toBeNull();
        expect(
            within(card('A word for the team?')).getByText('5 / 5'),
        ).not.toBeNull();
    });

    it('counts the answers of a text card in its header, as the other cards do', () => {
        renderWithProviders(<ResultsSummary snapshot={surveySnapshot()} />);

        expect(
            within(card('A word for the team?')).getByText('7 responses'),
        ).not.toBeNull();
    });

    it('shows the first six text answers as tinted cards, marks the viewer own, and leads to all of them', () => {
        const onShowFreeText = vi.fn();

        renderWithProviders(
            <ResultsSummary
                snapshot={surveySnapshot()}
                onShowFreeText={onShowFreeText}
            />,
        );

        const text = card('A word for the team?');
        const answers = within(text).getAllByRole('listitem');

        expect(answers).toHaveLength(6);
        expect(answers[0].textContent).toContain('Fewer meetings on Monday');
        expect(answers[0].textContent).toContain('Your answer');
        expect(answers[1].textContent).not.toContain('Your answer');
        expect(answers[0].className).toContain('bg-skrum-col-moss');
        expect(answers[1].className).toContain('bg-skrum-col-sky');
        expect(text.textContent).not.toContain('We shipped on time.');

        fireEvent.click(
            within(text).getByRole('button', { name: 'See the 7 answers' }),
        );

        expect(onShowFreeText).toHaveBeenCalledWith('q-text');
    });

    it('does not offer the other answers when there are six or fewer', () => {
        const results = structuredClone(mockupResults);

        results.questions['q-text'].answers = results.questions[
            'q-text'
        ].answers?.slice(0, 3);
        results.questions['q-text'].responses = 3;

        renderWithProviders(
            <ResultsSummary snapshot={surveySnapshot({ results })} />,
        );

        expect(
            within(card('A word for the team?')).queryByRole('button'),
        ).toBeNull();
    });

    it('says when nobody answered a question', () => {
        const results = structuredClone(mockupResults);

        results.questions['q-single'] = {
            responses: 0,
            options: [
                { id: 'o-retro', label: 'Retrospective', count: 0 },
                { id: 'o-daily', label: 'Daily', count: 0 },
                { id: 'o-poker', label: 'Planning poker', count: 0 },
                { id: 'o-review', label: 'Sprint review', count: 0 },
            ],
        };
        results.questions['q-text'] = { responses: 0, answers: [] };

        renderWithProviders(
            <ResultsSummary snapshot={surveySnapshot({ results })} />,
        );

        expect(
            within(card('Which ritual must we keep?')).getByText(
                'No answers yet.',
            ),
        ).not.toBeNull();
        expect(
            within(card('A word for the team?')).getByText('No answers yet.'),
        ).not.toBeNull();
        expect(
            within(card('Workload of the sprint')).queryByText(
                'No answers yet.',
            ),
        ).toBeNull();
    });

    it('carries the difference with another survey on the card it belongs to', () => {
        renderWithProviders(
            <ResultsSummary
                snapshot={surveySnapshot()}
                deltas={{ 'q-nps': { value: 11, against: 'Sprint 41' } }}
            />,
        );

        expect(
            within(card('Would you recommend the team?')).getByText(
                '+11 vs Sprint 41',
            ),
        ).not.toBeNull();
        expect(
            within(card('Workload of the sprint')).queryByText(/vs/),
        ).toBeNull();
    });

    it('updates the cards when the snapshot changes', () => {
        const { rerender } = renderWithProviders(
            <ResultsSummary snapshot={surveySnapshot()} />,
        );
        const results = structuredClone(mockupResults);

        results.questions['q-scale'].mean = 4.2;

        rerender(<ResultsSummary snapshot={surveySnapshot({ results })} />);

        expect(
            within(card('Workload of the sprint')).getByText('4.2'),
        ).not.toBeNull();
    });

    it('lays the cards out in a grid where a text question takes two columns', () => {
        const { container } = renderWithProviders(
            <ResultsSummary snapshot={surveySnapshot()} />,
        );

        expect(
            container.querySelector('[data-slot="survey-results-grid"]')
                ?.className,
        ).toContain(
            'grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(88)),1fr))]',
        );
        expect(card('A word for the team?').className).toContain('col-span-2');
    });
});
