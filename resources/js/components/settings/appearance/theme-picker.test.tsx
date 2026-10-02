import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ThemePicker } from './theme-picker';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { translations: {} };
});

describe('ThemePicker', () => {
    it('offers System, Light and Dark as radios of a group named Theme, in the order of the mockup', () => {
        renderWithProviders(<ThemePicker value="system" onChange={vi.fn()} />);

        const group = screen.getByRole('radiogroup', { name: 'Theme' });

        expect(
            within(group)
                .getAllByRole('radio')
                .map((radio) => radio.textContent),
        ).toEqual(['System', 'Light', 'Dark']);
    });

    it('checks the current theme only', () => {
        renderWithProviders(<ThemePicker value="dark" onChange={vi.fn()} />);

        expect(
            screen
                .getAllByRole('radio')
                .map((radio) => radio.getAttribute('aria-checked')),
        ).toEqual(['false', 'false', 'true']);
    });

    it('hands the chosen theme to its owner', () => {
        const onChange = vi.fn();
        renderWithProviders(<ThemePicker value="system" onChange={onChange} />);

        fireEvent.click(screen.getByRole('radio', { name: 'Light' }));

        expect(onChange).toHaveBeenCalledWith('light');
    });

    it('draws each preview in the scope of its theme, System with both halves', () => {
        renderWithProviders(<ThemePicker value="system" onChange={vi.fn()} />);

        const scopes = screen.getAllByRole('radio').map((radio) =>
            [
                ...radio.querySelectorAll(
                    '[data-slot="theme-preview"] > [data-theme]',
                ),
            ].map((half) => ({
                theme: half.getAttribute('data-theme'),
                scoped: half.classList.contains(
                    half.getAttribute('data-theme') ?? '',
                ),
            })),
        );

        expect(scopes).toEqual([
            [
                { theme: 'light', scoped: true },
                { theme: 'dark', scoped: true },
            ],
            [{ theme: 'light', scoped: true }],
            [{ theme: 'dark', scoped: true }],
        ]);
    });

    it('keeps the previews out of the name of a radio', () => {
        renderWithProviders(<ThemePicker value="system" onChange={vi.fn()} />);

        document
            .querySelectorAll('[data-slot="theme-preview"]')
            .forEach((preview) =>
                expect(preview.getAttribute('aria-hidden')).toBe('true'),
            );
    });
});
