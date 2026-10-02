import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HealthCheckForm } from '@/components/skrum/health-check-form';
import type {
    HealthCheckFormProps,
    HealthScore,
} from '@/components/skrum/health-check-form';
import { renderWithProviders } from '@/test/render';

const statements = [
    { key: 'a', label: 'Interaction', text: 'Interaction was productive' },
    { key: 'b', label: 'Vision', text: 'The vision is clear' },
];

function setup(
    answers: Record<string, HealthScore | null | undefined> = {},
    props: Partial<HealthCheckFormProps> = {},
) {
    const onAnswer = vi.fn();
    const onSubmit = vi.fn();
    const onClear = vi.fn();
    const view = renderWithProviders(
        <HealthCheckForm
            retroTitle="Sprint 42"
            statements={statements}
            answers={answers}
            onAnswer={onAnswer}
            onSubmit={onSubmit}
            onClear={onClear}
            {...props}
        />,
    );

    return { onAnswer, onSubmit, onClear, ...view };
}

function radios(label: string): HTMLElement[] {
    return within(screen.getByRole('radiogroup', { name: label })).getAllByRole(
        'radio',
    );
}

describe('HealthCheckForm', () => {
    it('offers the server scale, 1 to 10, with the selected value checked', () => {
        setup({ a: 8 });

        const group = screen.getByRole('radiogroup', { name: 'Interaction' });

        expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
        expect(radios('Interaction').map((r) => r.textContent)).toEqual([
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
            '10',
        ]);
        expect(
            screen
                .getAllByRole('radio', { checked: true })
                .map((r) => r.getAttribute('aria-label')),
        ).toEqual(['Score 8']);
        expect(group.getAttribute('aria-describedby')).toBeTruthy();
        expect(screen.getByText('10 · Great')).toBeTruthy();
    });

    it('shows an existing answer above 5 taken from the statement', () => {
        renderWithProviders(
            <HealthCheckForm
                retroTitle="Sprint 42"
                statements={[{ ...statements[0], myScore: 9 }, statements[1]]}
                onAnswer={vi.fn()}
            />,
        );

        expect(
            screen
                .getByRole('radio', { checked: true })
                .getAttribute('aria-label'),
        ).toBe('Score 9');
        expect(screen.getByText('1 of 2 answered')).toBeTruthy();
    });

    it('answers by click and by the digit keys, 0 meaning 10', async () => {
        const { onAnswer } = setup();

        await userEvent.click(radios('Interaction')[6]);
        expect(onAnswer).toHaveBeenLastCalledWith('a', 7);

        radios('Vision')[0].focus();
        await userEvent.keyboard('5');
        expect(onAnswer).toHaveBeenLastCalledWith('b', 5);

        await userEvent.keyboard('0');
        expect(onAnswer).toHaveBeenLastCalledWith('b', 10);
    });

    it('moves the answer with the arrow keys and wraps', async () => {
        const { onAnswer } = setup({ a: 10 });

        radios('Interaction')[9].focus();
        await userEvent.keyboard('{ArrowRight}');

        expect(onAnswer).toHaveBeenLastCalledWith('a', 1);
    });

    it('keeps a 1 to 5 scale when asked', async () => {
        const { onAnswer } = setup({}, { scale: 5 });

        expect(radios('Interaction')).toHaveLength(5);

        radios('Interaction')[0].focus();
        await userEvent.keyboard('7');

        expect(onAnswer).not.toHaveBeenCalled();
    });

    it('clears an answer and keeps the focus in the group', async () => {
        const { onClear } = setup({ a: 4 });

        expect(
            screen.queryByRole('button', { name: 'Clear: Vision' }),
        ).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'Clear: Interaction' }),
        );

        expect(onClear).toHaveBeenCalledWith('a');
        expect(document.activeElement).toBe(radios('Interaction')[0]);
    });

    it('shows who answered and how many, from the realtime progress', () => {
        const people = Array.from({ length: 14 }, (_, index) => ({
            id: `p${index}`,
            name: `Person ${index}`,
            avatarUrl: `/avatars/${index}.png`,
        }));

        renderWithProviders(
            <HealthCheckForm
                retroTitle="Sprint 42"
                statements={[
                    { ...statements[0], count: 14, answeredBy: people },
                    { ...statements[1], count: 0, answeredBy: [] },
                ]}
                onAnswer={vi.fn()}
            />,
        );

        expect(screen.getByText('14 answered')).toBeTruthy();
        expect(screen.getByText('0 answered')).toBeTruthy();
        expect(screen.getByText('+6')).toBeTruthy();
        expect(
            within(screen.getByRole('list', { name: 'Answered' })).getAllByRole(
                'listitem',
            ),
        ).toHaveLength(9);
    });

    it('has no submit button without a submit handler, only the progress', () => {
        renderWithProviders(
            <HealthCheckForm
                retroTitle="Sprint 42"
                statements={statements}
                answers={{ a: 4 }}
                onAnswer={vi.fn()}
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Submit answers' }),
        ).toBeNull();
        expect(screen.getByText('1 of 2 answered')).toBeTruthy();
    });

    it('keeps submit disabled until everything is answered and shows progress', async () => {
        const { onSubmit } = setup({ a: 4 });
        const submit = screen.getByRole('button', { name: 'Submit answers' });

        expect(screen.getByText('1 of 2 answered')).toBeTruthy();
        expect((submit as HTMLButtonElement).disabled).toBe(true);
        await userEvent.click(submit);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits once complete', async () => {
        const { onSubmit } = setup({ a: 4, b: 2 });

        await userEvent.click(
            screen.getByRole('button', { name: 'Submit answers' }),
        );

        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('is read-only once submitted', async () => {
        const { onAnswer } = setup({ a: 4, b: 2 }, { submitted: true });

        await userEvent.click(radios('Interaction')[0]);
        radios('Interaction')[3].focus();
        await userEvent.keyboard('2');

        expect(onAnswer).not.toHaveBeenCalled();
        expect(
            screen.queryByRole('button', { name: 'Submit answers' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: /^Clear/ })).toBeNull();
        expect(screen.getByRole('status').textContent).toContain(
            'Answers sent',
        );
    });

    it('ignores answers while disabled and reflects a remote progress change', async () => {
        const { onAnswer, rerender } = setup({ a: 4 }, { disabled: true });

        await userEvent.click(radios('Vision')[2]);
        expect(onAnswer).not.toHaveBeenCalled();

        rerender(
            <HealthCheckForm
                retroTitle="Sprint 42"
                statements={[{ ...statements[0], count: 3 }, statements[1]]}
                answers={{ a: 4 }}
                onAnswer={onAnswer}
            />,
        );

        expect(screen.getByText('3 answered')).toBeTruthy();
        expect(
            screen
                .getByRole('radio', { checked: true })
                .getAttribute('aria-label'),
        ).toBe('Score 4');
    });

    it('handles no statement, one statement and 200 statements with long text', () => {
        const { rerender } = setup({}, { statements: [] });

        expect(screen.getByText('No statements to answer.')).toBeTruthy();

        const many = Array.from({ length: 200 }, (_, index) => ({
            key: `s${index}`,
            label: `Label ${index} ${'x'.repeat(60)}`,
            text: 'y'.repeat(280),
        }));

        rerender(
            <HealthCheckForm
                retroTitle="Sprint 42"
                statements={many.slice(0, 1)}
                onAnswer={vi.fn()}
            />,
        );
        expect(screen.getAllByRole('radiogroup')).toHaveLength(1);

        rerender(
            <HealthCheckForm
                retroTitle="Sprint 42"
                statements={many}
                onAnswer={vi.fn()}
            />,
        );
        expect(screen.getAllByRole('radiogroup')).toHaveLength(200);
        expect(screen.getByText('0 of 200 answered')).toBeTruthy();
    });
});
