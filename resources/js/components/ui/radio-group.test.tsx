import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
import { renderWithProviders } from '@/test/render';

const options = [
    { value: 'all', label: 'Everyone', description: 'Votes are public' },
    { value: 'own', label: 'Only mine' },
    { value: 'none', label: 'Nobody', disabled: true },
];

function described(element: HTMLElement): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
}

describe('RadioGroup', () => {
    it('renders a labelled radiogroup with descriptions', () => {
        renderWithProviders(
            <RadioGroup
                aria-label="Vote visibility"
                value="all"
                options={options}
            />,
        );

        expect(screen.getByRole('radiogroup', { name: 'Vote visibility' })).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(3);
        expect(
            described(screen.getByRole('radio', { name: 'Everyone' })),
        ).toBe('Votes are public');
    });

    it('calls back with the chosen value from label click', () => {
        const onValueChange = vi.fn();

        renderWithProviders(
            <RadioGroup
                aria-label="Vote visibility"
                value="all"
                onValueChange={onValueChange}
                options={options}
                variant="card"
            />,
        );
        fireEvent.click(screen.getByText('Only mine'));

        expect(onValueChange).toHaveBeenCalledWith('own');
    });

    it('picks a card option from a click on its description, keeping the label as its name', () => {
        const onValueChange = vi.fn();

        renderWithProviders(
            <RadioGroup
                aria-label="Vote visibility"
                value="own"
                onValueChange={onValueChange}
                options={options}
                variant="card"
            />,
        );
        fireEvent.click(screen.getByText('Votes are public'));

        expect(onValueChange).toHaveBeenCalledWith('all');
        expect(
            described(screen.getByRole('radio', { name: 'Everyone' })),
        ).toBe('Votes are public');
    });

    it('moves selection with arrow keys, skipping disabled options', async () => {
        const user = userEvent.setup();

        function Harness() {
            const [value, setValue] = useState('all');

            return (
                <RadioGroup
                    aria-label="Vote visibility"
                    value={value}
                    onValueChange={setValue}
                    options={options}
                />
            );
        }
        renderWithProviders(<Harness />);

        await user.tab();
        expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Everyone' }));

        await user.keyboard('{ArrowDown>}');
        await waitFor(() =>
            expect(
                screen.getByRole('radio', { name: 'Only mine' }).getAttribute('aria-checked'),
            ).toBe('true'),
        );

        await user.keyboard('{/ArrowDown}{ArrowDown>}');
        await waitFor(() =>
            expect(
                screen.getByRole('radio', { name: 'Everyone' }).getAttribute('aria-checked'),
            ).toBe('true'),
        );
    });

    it('reflects value changes from props', () => {
        const { rerender } = renderWithProviders(
            <RadioGroup aria-label="x" value="all" options={options} />,
        );
        rerender(<RadioGroup aria-label="x" value="own" options={options} />);

        expect(screen.getByRole('radio', { name: 'Only mine' }).getAttribute('aria-checked')).toBe('true');
    });

    it('renders a card item whose children are the content of the radio', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderWithProviders(
            <RadioGroup aria-label="Deck" value="fibonacci" onValueChange={onValueChange}>
                <RadioGroupCardItem value="fibonacci">
                    <span>Fibonacci</span>
                </RadioGroupCardItem>
                <RadioGroupCardItem value="custom">
                    <span>Custom</span>
                    <span>3 cards</span>
                </RadioGroupCardItem>
            </RadioGroup>,
        );

        const custom = screen.getByRole('radio', { name: /Custom/ });
        expect(custom.textContent).toBe('Custom3 cards');
        expect(custom.getAttribute('aria-checked')).toBe('false');

        await user.click(screen.getByText('3 cards'));

        expect(onValueChange).toHaveBeenCalledWith('custom');
    });
});
