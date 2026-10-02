import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurveyQuestion } from '@/components/skrum/survey-question';
import type { SurveyQuestionProps } from '@/components/skrum/survey-question';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { renderWithProviders } from '@/test/render';

const options = [
    { id: 'a', label: 'Alpha', count: 3 },
    { id: 'b', label: 'Beta', count: 1 },
    { id: 'c', label: 'Gamma', count: 0 },
];

function setup(props: Partial<SurveyQuestionProps> = {}) {
    return renderWithProviders(
        <SurveyQuestion
            id="q1"
            kind="single"
            label="Pick one"
            mode="answer"
            options={options}
            {...props}
        />,
    );
}

describe('SurveyQuestion answer mode', () => {
    it('selects a single option and a digit key picks the nth option', () => {
        const onChange = vi.fn();
        setup({ onChange });

        fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));
        fireEvent.keyDown(screen.getByRole('radio', { name: 'Alpha' }), {
            key: '3',
        });

        expect(onChange).toHaveBeenNthCalledWith(1, 'b');
        expect(onChange).toHaveBeenNthCalledWith(2, 'c');
        expect(
            screen.getByRole('radiogroup', { name: 'Pick one' }),
        ).toBeTruthy();
    });

    it('scale5 picks with click and keys 1 to 5, and links the bounds', () => {
        const onChange = vi.fn();
        setup({
            kind: 'scale5',
            scaleLabels: ['Bad', 'Great'],
            onChange,
            value: 2,
        });

        expect(
            (screen.getByRole('radio', { name: '2' }) as HTMLInputElement)
                .checked,
        ).toBe(true);
        fireEvent.click(screen.getByRole('radio', { name: '4' }));
        fireEvent.keyDown(screen.getByRole('radio', { name: '2' }), {
            key: '5',
        });

        expect(onChange).toHaveBeenNthCalledWith(1, 4);
        expect(onChange).toHaveBeenNthCalledWith(2, 5);
        expect(
            screen.getByRole('radiogroup').getAttribute('aria-describedby'),
        ).toBeTruthy();
        expect(screen.getByText('Bad')).toBeTruthy();
    });

    it('nps renders 0 to 10', () => {
        setup({ kind: 'nps' });

        expect(screen.getAllByRole('radio')).toHaveLength(11);
    });

    it('multiple disables the remaining options at the limit and submits', () => {
        const onSubmit = vi.fn();
        setup({
            kind: 'multiple',
            maxChoices: 2,
            value: ['a', 'b'],
            onSubmit,
            onChange: vi.fn(),
        });

        expect(
            screen
                .getByRole('checkbox', { name: 'Gamma' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect(
            screen
                .getByRole('checkbox', { name: 'Alpha' })
                .hasAttribute('disabled'),
        ).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('multiple toggles a checkbox', () => {
        const onChange = vi.fn();
        setup({ kind: 'multiple', value: ['a'], onChange });

        fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));

        expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    });

    it('text shows a counter, caps at 280 and ignores digit shortcuts', () => {
        const onChange = vi.fn();
        const longText = 'x'.repeat(280);
        setup({ kind: 'text', value: longText, maxLength: 280, onChange });

        expect(
            document.querySelector('[data-slot="survey-char-counter"]')
                ?.textContent,
        ).toBe('280 / 280');

        fireEvent.keyDown(screen.getByRole('textbox'), { key: '2' });

        expect(onChange).not.toHaveBeenCalled();
    });

    it('text submit is disabled when blank, says Update answer once answered', () => {
        const { rerender } = setup({
            kind: 'text',
            value: '  ',
            onSubmit: vi.fn(),
        });

        expect(
            screen
                .getByRole('button', { name: 'Submit' })
                .hasAttribute('disabled'),
        ).toBe(true);

        rerender(
            <SurveyQuestion
                id="q1"
                kind="text"
                label="Pick one"
                mode="answer"
                value="hi"
                hasAnswered
                onSubmit={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Update answer' }),
        ).toBeTruthy();
    });

    it('closed disables everything and hides submit and withdraw', () => {
        const onChange = vi.fn();
        setup({
            closed: true,
            onChange,
            hasAnswered: true,
            onWithdraw: vi.fn(),
        });

        expect(
            screen
                .getByRole('radio', { name: 'Alpha' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect(screen.getByText('Closed')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Withdraw my answer' }),
        ).toBeNull();
    });

    it('withdraws, shows anonymous, required, error and slots', () => {
        const onWithdraw = vi.fn();
        setup({
            anonymous: true,
            required: true,
            invalid: true,
            hasAnswered: true,
            onWithdraw,
            actions: <button type="button">Menu</button>,
            footer: <p>Discussion</p>,
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Withdraw my answer' }),
        );

        expect(onWithdraw).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Anonymous')).toBeTruthy();
        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
        expect(screen.getByText('Discussion')).toBeTruthy();
    });

    it('shows the index and rerenders on value change', () => {
        const { rerender } = setup({ index: 1, count: 5, value: 'a' });

        expect(screen.getByText('1 / 5')).toBeTruthy();

        rerender(
            <SurveyQuestion
                id="q1"
                kind="single"
                label="Pick one"
                mode="answer"
                options={options}
                value="b"
            />,
        );

        expect(
            (screen.getByRole('radio', { name: 'Beta' }) as HTMLInputElement)
                .checked,
        ).toBe(true);
    });
});

describe('SurveyQuestion answer mode with results', () => {
    it('shows the counts to someone who answered and still lets them change or withdraw', () => {
        const onChange = vi.fn();
        const onWithdraw = vi.fn();
        const { container } = setup({
            value: 'a',
            hasAnswered: true,
            onChange,
            onWithdraw,
            results: { responses: 4 },
        });

        expect(
            container.querySelectorAll('[data-slot="survey-result-bar"]')
                .length,
        ).toBeGreaterThan(0);
        expect(screen.getByText('4 responses')).toBeTruthy();

        fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Withdraw my answer' }),
        );

        expect(onChange).toHaveBeenCalledWith('b');
        expect(onWithdraw).toHaveBeenCalledOnce();
    });

    it('shows no results in answer mode while they are hidden or absent', () => {
        const { container, rerender } = setup({
            results: { responses: 4, hidden: true },
        });

        expect(
            container.querySelector('[data-slot="survey-result-bar"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-slot="survey-results-hidden"]'),
        ).toBeNull();

        rerender(
            <SurveyQuestion
                id="q1"
                kind="single"
                label="Pick one"
                mode="answer"
                options={options}
            />,
        );

        expect(
            container.querySelector('[data-slot="survey-result-bar"]'),
        ).toBeNull();
    });
});

describe('SurveyQuestion digit keys', () => {
    it('prevents the default so a global reaction shortcut does not also fire', () => {
        const onChange = vi.fn();
        setup({ onChange });

        const notPrevented = fireEvent.keyDown(
            screen.getByRole('radio', { name: 'Alpha' }),
            { key: '2' },
        );

        expect(notPrevented).toBe(false);
        expect(onChange).toHaveBeenCalledWith('b');
    });

    it('ignores a digit typed in a field of its slots and one that another handler took', () => {
        const onChange = vi.fn();
        setup({
            onChange,
            footer: (
                <>
                    <input aria-label="Comment" />
                    <div
                        role="textbox"
                        aria-label="Rich comment"
                        tabIndex={0}
                    />
                </>
            ),
        });

        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Comment' }), {
            key: '2',
        });
        fireEvent.keyDown(
            screen.getByRole('textbox', { name: 'Rich comment' }),
            { key: '2' },
        );

        expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores a digit typed in content portaled out of the question', () => {
        const onChange = vi.fn();
        setup({
            onChange,
            footer: (
                <Popover open>
                    <PopoverTrigger>Open</PopoverTrigger>
                    <PopoverContent>
                        <button type="button">In popover</button>
                    </PopoverContent>
                </Popover>
            ),
        });

        const inside = screen.getByRole('button', { name: 'In popover' });

        expect(
            document
                .querySelector('[data-slot="survey-question"]')
                ?.contains(inside),
        ).toBe(false);

        fireEvent.keyDown(inside, { key: '2' });

        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('SurveyQuestion results mode', () => {
    it('shows percentages and counts, voters with avatar urls', () => {
        setup({
            mode: 'results',
            value: 'a',
            options: [
                {
                    ...options[0],
                    voters: [
                        {
                            id: 'u1',
                            name: 'Ada Lovelace',
                            avatarUrl: 'https://x/a.png',
                        },
                    ],
                },
                options[1],
            ],
            results: { responses: 4 },
        });

        expect(screen.getByText('75% · 3')).toBeTruthy();
        expect(screen.getByText('25% · 1')).toBeTruthy();
        expect(screen.getByText('4 responses')).toBeTruthy();
        expect(screen.getByText('Your answer')).toBeTruthy();
        expect(screen.getByLabelText('Ada Lovelace')).toBeTruthy();
    });

    it('multiple shows count first and handles zero responses', () => {
        setup({
            kind: 'multiple',
            mode: 'results',
            results: { responses: 0 },
            options: [{ id: 'a', label: 'Alpha', count: 0 }],
        });

        expect(screen.getByText('0 · 0%')).toBeTruthy();
    });

    it('hidden results never put counts in the DOM', () => {
        const { container } = setup({
            mode: 'results',
            results: { responses: 2, hidden: true },
        });

        expect(screen.getByText('Results are not visible yet.')).toBeTruthy();
        expect(container.textContent).not.toContain('75%');
        expect(
            container.querySelector('[data-slot="survey-result"]'),
        ).toBeNull();
    });

    it('scale5 shows the mean and nps an image histogram', () => {
        const { rerender } = setup({
            kind: 'scale5',
            mode: 'results',
            results: {
                responses: 3,
                mean: 3.67,
                buckets: [1, 2, 3, 4, 5].map((n) => ({
                    key: String(n),
                    label: String(n),
                    count: n === 4 ? 2 : 0,
                })),
            },
        });

        expect(screen.getByText('3.7')).toBeTruthy();

        rerender(
            <SurveyQuestion
                id="q1"
                kind="nps"
                label="Pick one"
                mode="results"
                results={{
                    responses: 2,
                    nps: 50,
                    buckets: [
                        { key: '3', label: '3', count: 1 },
                        { key: '10', label: '10', count: 1 },
                    ],
                }}
            />,
        );

        expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
            '10: 1',
        );
    });

    it('text results collapse 200 answers and expand on demand', () => {
        const textAnswers = Array.from({ length: 200 }, (_, i) => ({
            id: `t${i}`,
            text: `answer ${i}`,
        }));
        setup({
            kind: 'text',
            mode: 'results',
            results: {
                responses: 200,
                textAnswers,
                keywords: [{ word: 'speed', weight: 3 }],
                quotes: ['A quote'],
            },
        });

        expect(screen.getAllByRole('listitem').length).toBeLessThan(15);
        expect(screen.getByText('speed')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'See 195 more' }));

        expect(screen.getByText('answer 199')).toBeTruthy();
    });

    it('text results with no answers and a singular response count', () => {
        setup({
            kind: 'text',
            mode: 'results',
            results: { responses: 1, textAnswers: [] },
        });

        expect(screen.getByText('No answers yet.')).toBeTruthy();
        expect(screen.getByText('1 response')).toBeTruthy();
    });
});
