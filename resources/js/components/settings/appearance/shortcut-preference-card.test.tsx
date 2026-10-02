import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ShortcutPreferenceCard } from './shortcut-preference-card';

const patch = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { patch },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

describe('ShortcutPreferenceCard', () => {
    beforeEach(() => {
        patch.mockReset();
    });

    it('is the Accessibility region', () => {
        renderWithProviders(<ShortcutPreferenceCard enabled />);

        expect(
            screen.getByRole('region', { name: 'Accessibility' }),
        ).toBeTruthy();
    });

    it('shows the stored preference and saves it with the Save button', () => {
        renderWithProviders(<ShortcutPreferenceCard enabled />);

        const control = screen.getByRole('switch', {
            name: 'Single-key shortcuts',
        });

        expect(control.id).toBe('single-key-shortcuts');
        expect(control.getAttribute('aria-checked')).toBe('true');

        fireEvent.click(control);

        expect(control.getAttribute('aria-checked')).toBe('false');
        expect(patch).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(patch).toHaveBeenCalledTimes(1);
        expect(patch.mock.calls[0][0]).toBe('/settings/shortcuts');
        expect(patch.mock.calls[0][1]).toEqual({ single_key_shortcuts: false });
        expect(patch.mock.calls[0][2]).toMatchObject({ preserveScroll: true });
    });

    it('says what stays available when they are off', () => {
        renderWithProviders(<ShortcutPreferenceCard enabled={false} />);

        const control = screen.getByRole('switch', {
            name: 'Single-key shortcuts',
        });
        const description = screen.getByText(
            'When off, shortcuts made of a single letter, digit or sign do nothing. Shortcuts with ⌘ or Ctrl, Enter, Escape and the arrows keep working.',
        );

        expect(control.getAttribute('aria-checked')).toBe('false');
        expect(control.getAttribute('aria-describedby')).toBe(description.id);
    });
});
