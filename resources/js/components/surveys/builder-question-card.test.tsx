import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BuilderQuestionCard } from '@/components/surveys/builder-question-card';
import type { SurveyQuestionPayload } from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

function question(
    overrides: Partial<SurveyQuestionPayload> = {},
): SurveyQuestionPayload {
    return {
        id: 'q-1',
        kind: 'scale',
        label: 'How do you rate the workload?',
        shortLabel: null,
        description: null,
        position: 0,
        isRequired: true,
        allowsComment: true,
        scaleMax: 5,
        scaleLabels: ['Unbearable', 'Very comfortable'],
        isBuiltin: false,
        options: [],
        myAnswer: null,
        ...overrides,
    };
}

const single = question({
    id: 'q-3',
    kind: 'single',
    label: 'Which ritual should we keep?',
    isRequired: false,
    allowsComment: false,
    scaleMax: null,
    scaleLabels: null,
    options: [
        { id: 'o-1', label: 'Daily' },
        { id: 'o-2', label: 'Review' },
        { id: 'o-3', label: 'Retro' },
        { id: 'o-4', label: 'Planning' },
    ],
});

describe('BuilderQuestionCard', () => {
    it('shows a collapsed choice with its options, kind and number', () => {
        const onOpen = vi.fn();

        renderWithProviders(
            <BuilderQuestionCard
                question={single}
                number={3}
                open={false}
                mode="edit"
                onOpen={onOpen}
            />,
        );

        const card = screen.getByRole('region', { name: 'Question 3' });

        expect(card.getAttribute('data-test')).toBe('survey-question');
        expect(within(card).getByText('4 options')).toBeTruthy();
        expect(within(card).getByText('Single choice')).toBeTruthy();
        expect(within(card).queryByText('Required')).toBeNull();

        fireEvent.click(
            within(card).getByRole('button', {
                name: 'Which ritual should we keep?',
            }),
        );

        expect(onOpen).toHaveBeenCalled();
    });

    it("shows a question's whole text in the editor", () => {
        const label =
            'Les échanges avec mes collègues ont été productifs pendant ce sprint';

        const { rerender } = renderWithProviders(
            <BuilderQuestionCard
                question={question({ label })}
                number={1}
                open={false}
                mode="edit"
            />,
        );

        const editable = screen.getByRole('button', { name: label });

        expect(editable.classList.contains('truncate')).toBe(false);
        expect(editable.classList.contains('break-words')).toBe(true);
        expect(editable.classList.contains('min-w-0')).toBe(true);

        rerender(
            <BuilderQuestionCard
                question={question({ label })}
                number={1}
                open={false}
                mode="locked"
            />,
        );

        const readOnly = screen.getByText(label);

        expect(readOnly.classList.contains('truncate')).toBe(false);
        expect(readOnly.classList.contains('break-words')).toBe(true);
    });

    it('keeps the kind and Required badges together', () => {
        renderWithProviders(
            <BuilderQuestionCard
                question={question()}
                number={1}
                open={false}
                mode="edit"
            />,
        );

        const badges = screen
            .getByRole('region', { name: 'Question 1' })
            .querySelector('[data-slot="survey-question-badges"]');

        expect(badges).not.toBeNull();
        expect(badges?.classList.contains('shrink-0')).toBe(true);
        expect(
            Array.from(
                badges?.querySelectorAll('[data-slot="badge"]') ?? [],
            ).map((badge) => badge.textContent),
        ).toEqual(['Scale 1 – 5', 'Required']);
        expect(
            badges?.querySelector('[data-slot="badge"]')?.className,
        ).not.toContain('max-sm:hidden');

        const header = badges?.parentElement;

        expect(header?.classList.contains('flex-wrap')).toBe(true);
        expect(header?.classList.contains('items-start')).toBe(true);
        expect(header?.firstElementChild?.classList.contains('flex-1')).toBe(
            true,
        );
    });

    it('shows the required badge and the length of a text', () => {
        renderWithProviders(
            <BuilderQuestionCard
                question={question({
                    kind: 'text',
                    scaleMax: null,
                    scaleLabels: null,
                })}
                number={5}
                open={false}
                mode="edit"
            />,
        );

        expect(screen.getByText('500 characters max')).toBeTruthy();
        expect(screen.getByText('Required')).toBeTruthy();
        expect(screen.getByText('Free text')).toBeTruthy();
    });

    it('opens a scale on its fields', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <BuilderQuestionCard
                question={question()}
                number={1}
                open
                mode="edit"
                onChange={onChange}
            />,
        );

        expect(
            (document.getElementById('question-label-q-1') as HTMLInputElement)
                .value,
        ).toBe('How do you rate the workload?');
        expect(screen.getByRole('combobox', { name: 'Kind' }).id).toBe(
            'question-kind-q-1',
        );
        expect(
            screen
                .getByRole('switch', { name: 'Required' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            (screen.getByLabelText('Label of 1') as HTMLInputElement).value,
        ).toBe('Unbearable');

        fireEvent.change(screen.getByLabelText('Label of 5'), {
            target: { value: 'Easy' },
        });

        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ scaleLabels: ['Unbearable', 'Easy'] }),
        );

        fireEvent.click(screen.getByRole('switch', { name: 'Required' }));

        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ isRequired: false }),
        );
    });

    it('opens a choice on its options', () => {
        renderWithProviders(
            <BuilderQuestionCard
                question={single}
                number={3}
                open
                mode="edit"
                onChange={vi.fn()}
            />,
        );

        expect(
            screen.getAllByRole('textbox', { name: /^Option \d$/ }),
        ).toHaveLength(4);
        expect(screen.getByRole('button', { name: 'Add option' })).toBeTruthy();
    });

    it('shows the fixed ends of an NPS', () => {
        renderWithProviders(
            <BuilderQuestionCard
                question={question({
                    kind: 'nps',
                    scaleMax: null,
                    scaleLabels: null,
                })}
                number={2}
                open
                mode="edit"
            />,
        );

        expect(screen.getByText('0 · Not at all likely')).toBeTruthy();
        expect(screen.getByText('10 · Extremely likely')).toBeTruthy();
    });

    it('changes the kind through withKind', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(
            <BuilderQuestionCard
                question={question({
                    kind: 'text',
                    scaleMax: null,
                    scaleLabels: null,
                })}
                number={1}
                open
                mode="edit"
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole('combobox', { name: 'Kind' }));
        await user.click(screen.getByRole('option', { name: 'Single choice' }));

        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({
                kind: 'single',
                options: [
                    { id: 'new-0', label: 'Option 1' },
                    { id: 'new-1', label: 'Option 2' },
                ],
            }),
        );
    });

    it('duplicates and deletes', () => {
        const onDuplicate = vi.fn();
        const onDelete = vi.fn();

        renderWithProviders(
            <BuilderQuestionCard
                question={question()}
                number={1}
                open
                mode="edit"
                onDuplicate={onDuplicate}
                onDelete={onDelete}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(onDuplicate).toHaveBeenCalled();
        expect(onDelete).toHaveBeenCalled();
    });

    it('shows the error of a failed save on the label', () => {
        renderWithProviders(
            <BuilderQuestionCard
                question={question()}
                number={1}
                open
                mode="edit"
                error="The label may not be greater than 200 characters."
            />,
        );

        const label = document.getElementById('question-label-q-1')!;

        expect(label.getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByRole('alert').textContent).toBe(
            'The label may not be greater than 200 characters.',
        );
    });

    it('shows a health-check statement read only on the scale with its ends', () => {
        renderWithProviders(
            <BuilderQuestionCard
                question={question({
                    label: 'We deliver value',
                    isBuiltin: true,
                    scaleLabels: null,
                })}
                number={1}
                open
                mode="locked"
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
        expect(
            screen.getByText('Strongly disagree').closest('[aria-hidden]'),
        ).toBeNull();
        expect(
            screen.getByText('Strongly agree').closest('[aria-hidden]'),
        ).toBeNull();
    });

    it('shows a question of an open survey without any control', () => {
        renderWithProviders(
            <BuilderQuestionCard
                question={single}
                number={3}
                open
                mode="readonly"
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByText('Which ritual should we keep?')).toBeTruthy();
    });
});
