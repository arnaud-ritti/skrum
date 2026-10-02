import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ReadModeLayer, ReadModeToggle } from './read-mode-toggle';

describe('ReadModeToggle', () => {
    it('offers "Edit" while reading, pressed, and leaves read mode on a press', () => {
        const onChange = vi.fn();

        renderWithProviders(<ReadModeToggle reading onChange={onChange} />);

        const button = screen.getByRole('button', { name: 'Edit' });

        expect(button.getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(button);

        expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it('offers "Read" while editing, not pressed, and goes back to read mode on a press', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <ReadModeToggle reading={false} onChange={onChange} />,
        );

        const button = screen.getByRole('button', { name: 'Read' });

        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();

        fireEvent.click(button);

        expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    });
});

describe('ReadModeLayer', () => {
    it('says "Reading" over the canvas while reading, beside the toggle', () => {
        const { container } = renderWithProviders(
            <ReadModeLayer reading onChange={vi.fn()} />,
        );

        expect(
            container.querySelector('[data-slot="read-mode-state"]')
                ?.textContent,
        ).toBe('Reading');
        expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    });

    it('keeps the toggle alone while editing', () => {
        const { container } = renderWithProviders(
            <ReadModeLayer reading={false} onChange={vi.fn()} />,
        );

        expect(
            container.querySelector('[data-slot="read-mode-state"]'),
        ).toBeNull();
        expect(screen.getByRole('button', { name: 'Read' })).toBeTruthy();
    });

    it('renders nothing in the places left for later features', () => {
        const { container } = renderWithProviders(
            <ReadModeLayer reading onChange={vi.fn()} />,
        );

        expect(
            container.querySelector('[data-slot="read-mode-dock"]')
                ?.childElementCount,
        ).toBe(1);
        expect(
            container.querySelector('[data-slot="read-mode-top"]')
                ?.childElementCount,
        ).toBe(1);
    });
});
