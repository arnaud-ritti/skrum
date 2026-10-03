import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ReadModeLayer, ReadModeToggle } from './read-mode-toggle';

describe('ReadModeToggle', () => {
    it('offers "Edit" while reading, as an action and not a pressed state, and leaves read mode on a press', () => {
        const onChange = vi.fn();

        renderWithProviders(<ReadModeToggle reading onChange={onChange} />);

        const button = screen.getByRole('button', { name: 'Edit' });

        expect(button.hasAttribute('aria-pressed')).toBe(false);

        fireEvent.click(button);

        expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it('offers "Read" while editing and goes back to read mode on a press', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <ReadModeToggle reading={false} onChange={onChange} />,
        );

        const button = screen.getByRole('button', { name: 'Read' });

        expect(button.hasAttribute('aria-pressed')).toBe(false);
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

    it('keeps the toggle alone on screen while editing', () => {
        const { container } = renderWithProviders(
            <ReadModeLayer reading={false} onChange={vi.fn()} />,
        );

        expect(
            container.querySelector('[data-slot="read-mode-state"]'),
        ).toBeNull();
        expect(screen.getByRole('button', { name: 'Read' })).toBeTruthy();
    });

    it('announces the mode in one polite region that stays mounted, so a change is read out', () => {
        const { container, rerender } = renderWithProviders(
            <ReadModeLayer reading onChange={vi.fn()} />,
        );
        const region = screen.getByRole('status');

        expect(region.tagName).toBe('SPAN');
        expect(region.textContent).toBe('Reading');

        rerender(<ReadModeLayer reading={false} onChange={vi.fn()} />);

        expect(screen.getByRole('status')).toBe(region);
        expect(region.textContent).toBe('Editing');
        expect(container.querySelectorAll('div[role="status"]')).toHaveLength(
            0,
        );
    });

    it('puts the dock actions before the toggle', () => {
        const { container } = renderWithProviders(
            <ReadModeLayer
                reading
                onChange={vi.fn()}
                dockActions={<button type="button">Fit to screen</button>}
            />,
        );
        const dock = container.querySelector('[data-slot="read-mode-dock"]');

        expect(
            Array.from(dock?.querySelectorAll('button') ?? []).map(
                (button) => button.textContent,
            ),
        ).toEqual(['Fit to screen', 'Edit']);
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
