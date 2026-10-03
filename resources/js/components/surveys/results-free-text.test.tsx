import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { mockupResults, surveySnapshot } from '@/test/survey-results';
import { ResultsFreeText } from './results-free-text';

function section(label: string): HTMLElement {
    return screen.getByRole('region', { name: label });
}

describe('ResultsFreeText', () => {
    it('lists every answer of a text question, in the order the server sent them', () => {
        renderWithProviders(<ResultsFreeText snapshot={surveySnapshot()} />);

        const answers = within(section('A word for the team?')).getAllByRole(
            'listitem',
        );

        expect(answers).toHaveLength(7);
        expect(answers.map((answer) => answer.textContent)).toEqual(
            mockupResults.questions['q-text'].answers?.map((answer) =>
                answer.isMine ? `${answer.text}Your answer` : answer.text,
            ),
        );
    });

    it('lists the comments of a scale question that takes them', () => {
        renderWithProviders(<ResultsFreeText snapshot={surveySnapshot()} />);

        const comments = within(section('Workload of the sprint')).getAllByRole(
            'listitem',
        );

        expect(comments.map((comment) => comment.textContent)).toEqual([
            'Heavy but fine.',
            'Too many tickets.Your answer',
        ]);
    });

    it('leaves out the questions that take no free text', () => {
        renderWithProviders(<ResultsFreeText snapshot={surveySnapshot()} />);

        expect(screen.getAllByRole('region')).toHaveLength(2);
        expect(
            screen.queryByRole('region', {
                name: 'Which ritual must we keep?',
            }),
        ).toBeNull();
        expect(
            screen.queryByRole('region', {
                name: 'Would you recommend the team?',
            }),
        ).toBeNull();
    });

    it('says when a question has no free text yet', () => {
        const results = structuredClone(mockupResults);

        results.questions['q-scale'].comments = [];

        renderWithProviders(
            <ResultsFreeText snapshot={surveySnapshot({ results })} />,
        );

        expect(
            within(section('Workload of the sprint')).getByText(
                'No answers yet.',
            ),
        ).not.toBeNull();
    });
});
