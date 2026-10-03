import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { mockupComparable, mockupComparison } from '@/test/survey-results';
import { ResultsCompare } from './results-compare';

const api = vi.hoisted(() => ({ comparison: vi.fn() }));

vi.mock('@/lib/surveys/api', () => ({ surveyApi: api }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    };
});

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    api.comparison.mockReset();
});

function row(label: string): HTMLElement {
    return screen.getByRole('listitem', { name: label });
}

describe('ResultsCompare', () => {
    it('says nothing compares yet when the team has no other closed survey', () => {
        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={{ defaultId: null, surveys: [] }}
            />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'Nothing to compare with yet.',
        );
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(api.comparison).not.toHaveBeenCalled();
    });

    it('selects the default survey, shows a skeleton, then one row per question', async () => {
        api.comparison.mockResolvedValue({ comparison: mockupComparison });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        const select = screen.getByRole('combobox', { name: 'Compare with' });

        expect(select.id).toBe('survey-compare-with');
        expect(select.textContent).toMatch(/^Sprint 41 · Sep 19, 2026/);
        expect(screen.getByRole('status', { name: 'Loading' })).not.toBeNull();
        expect(api.comparison).toHaveBeenCalledWith('survey-1', 'survey-41');

        await screen.findByRole('listitem', { name: 'Workload of the sprint' });

        expect(row('Workload of the sprint').textContent).toContain(
            'Scale 1 to 5',
        );
        expect(row('Workload of the sprint').textContent).toContain('3.8 / 5');
        expect(row('Workload of the sprint').textContent).toContain('3.4 / 5');
        expect(row('Workload of the sprint').textContent).toContain(
            '+0.4, higher',
        );
        expect(row('Would you recommend the team?').textContent).toContain(
            '+11 points, higher',
        );
        expect(row('Which ritual must we keep?').textContent).toContain(
            '−10 percentage points, lower',
        );
        expect(row('Which ritual must we keep?').textContent).toContain(
            'no change',
        );
        expect(row('A word for the team?').textContent).toContain('7 answers');
        expect(row('A word for the team?').textContent).toContain('5 answers');
    });

    it('lists the questions that only one of the two surveys asks', async () => {
        api.comparison.mockResolvedValue({ comparison: mockupComparison });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        const here = await screen.findByRole('region', {
            name: 'Only in this survey',
        });

        expect(here.textContent).toContain('What slowed you down?');
        expect(
            screen.getByRole('region', { name: 'Only in Sprint 41' })
                .textContent,
        ).toContain('Mood of the week');
    });

    it('asks for the survey picked in the select', async () => {
        const user = userEvent.setup();

        api.comparison.mockResolvedValue({ comparison: mockupComparison });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        await user.click(
            screen.getByRole('combobox', { name: 'Compare with' }),
        );
        await user.click(
            within(screen.getByRole('listbox')).getByRole('option', {
                name: /^Sprint 40/,
            }),
        );

        await waitFor(() =>
            expect(api.comparison).toHaveBeenLastCalledWith(
                'survey-1',
                'survey-40',
            ),
        );
    });

    it('offers a retry when the comparison fails to load', async () => {
        const user = userEvent.setup();

        api.comparison
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue({ comparison: mockupComparison });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        await user.click(await screen.findByRole('button', { name: 'Retry' }));

        expect(
            await screen.findByRole('listitem', {
                name: 'Workload of the sprint',
            }),
        ).not.toBeNull();
        expect(api.comparison).toHaveBeenCalledTimes(2);
    });

    it('says so when the other survey has too few answers', async () => {
        api.comparison.mockResolvedValue({
            comparison: {
                ...mockupComparison,
                belowThreshold: true,
                pairs: [],
            },
        });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        expect(
            await screen.findByText(
                'The other survey does not have enough answers.',
            ),
        ).not.toBeNull();
        expect(screen.queryByRole('listitem')).toBeNull();
    });

    it('reuses the default comparison it is handed, without asking again', () => {
        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
                defaultLoad={{ status: 'ready', comparison: mockupComparison }}
            />,
        );

        expect(row('Workload of the sprint')).not.toBeNull();
        expect(api.comparison).not.toHaveBeenCalled();
    });
});
