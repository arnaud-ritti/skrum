import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from '@/components/ui/checkbox';
import { renderWithProviders } from '@/test/render';

function described(element: HTMLElement): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
}

describe('Checkbox', () => {
    it('keeps the bare primitive working with an external label', () => {
        const onCheckedChange = vi.fn();

        renderWithProviders(
            <Checkbox aria-label="Accept" onCheckedChange={onCheckedChange} />,
        );
        fireEvent.click(screen.getByRole('checkbox', { name: 'Accept' }));

        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('toggles from the label text and the Space key', () => {
        function Harness() {
            const [checked, setChecked] = useState<boolean | 'indeterminate'>(
                false,
            );

            return (
                <Checkbox
                    checked={checked}
                    onCheckedChange={setChecked}
                    label="Allow reactions"
                    description="Shown to everyone"
                />
            );
        }
        renderWithProviders(<Harness />);
        const box = screen.getByRole('checkbox', { name: 'Allow reactions' });

        expect(described(box)).toBe('Shown to everyone');

        fireEvent.click(screen.getByText('Allow reactions'));
        expect(box.getAttribute('aria-checked')).toBe('true');

        fireEvent.click(box);
        expect(box.getAttribute('aria-checked')).toBe('false');
    });

    it('exposes the mixed state and follows prop changes', () => {
        const { rerender } = renderWithProviders(
            <Checkbox checked="indeterminate" label="All" />,
        );
        const box = screen.getByRole('checkbox', { name: 'All' });

        expect(box.getAttribute('aria-checked')).toBe('mixed');

        rerender(<Checkbox checked label="All" />);
        expect(box.getAttribute('aria-checked')).toBe('true');
    });

    it('does not call back when disabled', () => {
        const onCheckedChange = vi.fn();

        renderWithProviders(
            <Checkbox disabled label="Nope" onCheckedChange={onCheckedChange} />,
        );
        fireEvent.click(screen.getByText('Nope'));

        expect(onCheckedChange).not.toHaveBeenCalled();
    });
});
