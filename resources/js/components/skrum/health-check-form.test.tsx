import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HealthCheckForm } from '@/components/skrum/health-check-form';
import type { HealthScore } from '@/components/skrum/health-check-form';
import { renderWithProviders } from '@/test/render';

const statements = [
    { id: 'a', label: 'Interaction', text: 'Interaction was productive' },
    { id: 'b', label: 'Vision', text: 'The vision is clear' },
];

function setup(
    answers: Record<string, HealthScore | undefined> = {},
    submitted = false,
) {
    const onAnswer = vi.fn();
    const onSubmit = vi.fn();
    renderWithProviders(
        <HealthCheckForm
            retroTitle="Sprint 42"
            statements={statements}
            answers={answers}
            onAnswer={onAnswer}
            onSubmit={onSubmit}
            submitted={submitted}
        />,
    );

    return { onAnswer, onSubmit };
}

describe('HealthCheckForm', () => {
    it('renders one radiogroup per statement with the selected value checked', () => {
        setup({ a: 4 });

        const group = screen.getByRole('radiogroup', { name: 'Interaction' });
        expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
        expect(
            screen
                .getAllByRole('radio', { checked: true })
                .map((r) => r.textContent),
        ).toEqual(['4']);
        expect(group.getAttribute('aria-describedby')).toBeTruthy();
    });

    it('answers by click and by keys 1 to 5', async () => {
        const { onAnswer } = setup();

        await userEvent.click(screen.getAllByRole('radio', { name: '3' })[0]);
        expect(onAnswer).toHaveBeenLastCalledWith('a', 3);

        screen.getAllByRole('radio', { name: '1' })[1].focus();
        await userEvent.keyboard('5');
        expect(onAnswer).toHaveBeenLastCalledWith('b', 5);
    });

    it('moves the answer with the arrow keys and wraps', async () => {
        const { onAnswer } = setup({ a: 5 });

        screen.getAllByRole('radio', { name: '5' })[0].focus();
        await userEvent.keyboard('{ArrowRight}');

        expect(onAnswer).toHaveBeenLastCalledWith('a', 1);
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
        const { onAnswer } = setup({ a: 4, b: 2 }, true);

        await userEvent.click(screen.getAllByRole('radio', { name: '1' })[0]);
        screen.getAllByRole('radio', { name: '4' })[0].focus();
        await userEvent.keyboard('2');

        expect(onAnswer).not.toHaveBeenCalled();
        expect(
            screen.queryByRole('button', { name: 'Submit answers' }),
        ).toBeNull();
        expect(screen.getByRole('status').textContent).toContain(
            'Answers sent',
        );
    });
});
