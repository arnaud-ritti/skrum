import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderAddBar } from '@/components/surveys/builder-add-bar';
import { renderWithProviders } from '@/test/render';

describe('BuilderAddBar', () => {
    it('offers the five kinds in the order of the mockup', () => {
        renderWithProviders(
            <BuilderAddBar questionCount={2} onAdd={vi.fn()} />,
        );

        const group = screen.getByRole('group', { name: 'Add a question' });

        expect(
            within(group)
                .getAllByRole('button')
                .map((button) => button.textContent),
        ).toEqual([
            'Scale 1 – 5',
            'NPS',
            'Single choice',
            'Multiple choice',
            'Free text',
        ]);
    });

    it('adds the kind of the chip clicked', () => {
        const onAdd = vi.fn();

        renderWithProviders(<BuilderAddBar questionCount={2} onAdd={onAdd} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Multiple choice' }),
        );

        expect(onAdd).toHaveBeenCalledWith('multiple');
    });

    it('disables every kind at 30 questions with the reason', () => {
        renderWithProviders(
            <BuilderAddBar questionCount={30} onAdd={vi.fn()} />,
        );

        const group = screen.getByRole('group', { name: 'Add a question' });

        expect(
            within(group)
                .getAllByRole('button')
                .every((button) => (button as HTMLButtonElement).disabled),
        ).toBe(true);
        expect(group.getAttribute('aria-describedby')).not.toBeNull();
        expect(
            screen.getByText('A survey can have at most 30 questions.'),
        ).toBeTruthy();
    });
});
