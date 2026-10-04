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

function tableRows(table: HTMLElement): string[][] {
    return Array.from(table.querySelectorAll('tr')).map((tableRow) =>
        Array.from(tableRow.querySelectorAll('th, td')).map(
            (cell) => cell.textContent ?? '',
        ),
    );
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

        const scale = row('Workload of the sprint');

        expect(scale.textContent).toContain('Scale 1 to 5');
        expect(scale.textContent).toContain('3.8 / 5');
        expect(scale.textContent).toContain('3.5 / 5');
        expect(
            scale.querySelector('[data-slot="survey-compare-legend"]')
                ?.textContent,
        ).toBe('NowBefore');

        const chart = scale.querySelector(
            '[data-slot="survey-compare-chart"]',
        ) as HTMLElement;

        expect(chart.getAttribute('aria-hidden')).toBe('true');
        expect(chart.querySelectorAll('[data-series="now"]')).toHaveLength(5);
        expect(chart.querySelectorAll('[data-series="before"]')).toHaveLength(
            5,
        );
        expect(
            row('Would you recommend the team?').querySelectorAll(
                '[data-series="before"]',
            ),
        ).toHaveLength(11);
        expect(row('Would you recommend the team?').textContent).toContain(
            '+22',
        );
        expect(
            row('Which ritual must we keep?').querySelectorAll(
                '[data-series="now"]',
            ),
        ).toHaveLength(2);
        expect(
            tableRows(within(row('A word for the team?')).getByRole('table')),
        ).toEqual([
            ['Value', 'Now', 'Before'],
            ['Answers', '7', '5'],
        ]);
    });

    it('gives the two series of each question as a table, without a difference', async () => {
        api.comparison.mockResolvedValue({ comparison: mockupComparison });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        await screen.findByRole('listitem', { name: 'Workload of the sprint' });

        expect(
            tableRows(
                screen.getByRole('table', { name: 'Workload of the sprint' }),
            ),
        ).toEqual([
            ['Value', 'Now', 'Before'],
            ['1', '0%', '0%'],
            ['2', '11%', '13%'],
            ['3', '22%', '38%'],
            ['4', '44%', '38%'],
            ['5', '22%', '13%'],
        ]);
        expect(
            tableRows(
                screen.getByRole('table', {
                    name: 'Which ritual must we keep?',
                }),
            ),
        ).toEqual([
            ['Option', 'Now', 'Before'],
            ['Retrospective', '56%', '50%'],
            ['Daily', '22%', '38%'],
        ]);
        expect(document.body.textContent).not.toContain('Difference');
        expect(document.body.textContent).not.toContain('higher');
        expect(document.body.textContent).not.toContain('lower');
    });

    it('shows the tables in place of the charts on request', async () => {
        api.comparison.mockResolvedValue({ comparison: mockupComparison });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        await screen.findByRole('listitem', { name: 'Workload of the sprint' });

        const table = screen.getByRole('table', {
            name: 'Workload of the sprint',
        });

        expect(table.className).toContain('sr-only');

        await userEvent.click(
            screen.getByRole('button', { name: 'View as table' }),
        );

        expect(
            screen.getByRole('table', { name: 'Workload of the sprint' })
                .className,
        ).not.toContain('sr-only');
        expect(
            document.querySelector('[data-slot="survey-compare-chart"]'),
        ).toBeNull();
        expect(
            screen.getByRole('button', { name: 'View as chart' }),
        ).not.toBeNull();
    });

    it('draws the two means when the two scales are not of the same length', async () => {
        const [scale] = mockupComparison.pairs;

        api.comparison.mockResolvedValue({
            comparison: {
                ...mockupComparison,
                pairs: [
                    {
                        ...scale,
                        other: {
                            mean: 3.4,
                            responses: 8,
                            shares: Array.from({ length: 10 }, (_, index) => ({
                                key: String(index + 1),
                                label: String(index + 1),
                                percent: 10,
                            })),
                        },
                    },
                ],
            },
        });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        await screen.findByRole('listitem', { name: 'Workload of the sprint' });

        expect(
            tableRows(
                screen.getByRole('table', { name: 'Workload of the sprint' }),
            ),
        ).toEqual([
            ['Value', 'Now', 'Before'],
            ['Average', '3.8 / 5', '3.4 / 5'],
        ]);
    });

    it('tells each option of a choice apart by its id, even when two share a label', async () => {
        const [, , single] = mockupComparison.pairs;

        api.comparison.mockResolvedValue({
            comparison: {
                ...mockupComparison,
                pairs: [
                    {
                        ...single,
                        current: {
                            responses: 9,
                            options: [
                                { id: 'o-a', label: 'Other', percent: 40 },
                                { id: 'o-b', label: 'Other', percent: 10 },
                            ],
                        },
                        delta: [
                            { optionId: 'o-a', label: 'Other', delta: 5 },
                            { optionId: 'o-b', label: 'Other', delta: -5 },
                        ],
                    },
                ],
            },
        });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        await screen.findByRole('listitem', {
            name: 'Which ritual must we keep?',
        });

        expect(
            tableRows(
                screen.getByRole('table', {
                    name: 'Which ritual must we keep?',
                }),
            ).map(([, now]) => now),
        ).toEqual(['Now', '40%', '10%']);
    });

    it('says no option is in common when both surveys have answers but no shared option', async () => {
        const [, , single] = mockupComparison.pairs;

        api.comparison.mockResolvedValue({
            comparison: {
                ...mockupComparison,
                pairs: [{ ...single, delta: [] }],
            },
        });

        renderWithProviders(
            <ResultsCompare
                surveyId="survey-1"
                comparable={mockupComparable}
            />,
        );

        const choice = await screen.findByRole('listitem', {
            name: 'Which ritual must we keep?',
        });

        expect(choice.textContent).toContain('No option in common.');
        expect(choice.textContent).not.toContain('No answers to compare.');
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
