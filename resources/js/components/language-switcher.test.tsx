import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from '@/components/language-switcher';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: {
            translations: {},
            locale: 'fr',
            locales: ['en', 'fr', 'es', 'de'],
        },
    }),
    router: { put: mocks.put },
}));

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.put.mockReset();
});

describe('LanguageSwitcher', () => {
    it('shows the current language on a named control', () => {
        renderWithProviders(<LanguageSwitcher />);

        expect(
            screen.getByRole('combobox', { name: 'Language' }).textContent,
        ).toBe('Français');
    });

    it('saves the chosen language without moving the page', async () => {
        renderWithProviders(<LanguageSwitcher />);

        await userEvent.click(
            screen.getByRole('combobox', { name: 'Language' }),
        );
        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['English', 'Français', 'Español', 'Deutsch']);

        await userEvent.click(screen.getByRole('option', { name: 'Deutsch' }));

        expect(mocks.put).toHaveBeenCalledTimes(1);
        expect(mocks.put.mock.calls[0][1]).toEqual({ locale: 'de' });
        expect(mocks.put.mock.calls[0][2]).toEqual({ preserveScroll: true });
    });
});
