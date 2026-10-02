import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { LanguageField } from './language-field';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const mocks = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { put: mocks.put },
}));

beforeEach(() => {
    mocks.put.mockReset();
    page.props = {
        translations: {},
        locale: 'fr',
        locales: ['en', 'fr', 'es', 'de'],
    };
});

function options(): HTMLElement[] {
    return within(
        screen.getByRole('radiogroup', { name: 'Language' }),
    ).getAllByRole('radio');
}

describe('LanguageField', () => {
    it('lists every language of the instance under its own name, in a control named Language', () => {
        renderWithProviders(<LanguageField />);

        expect(options().map((option) => option.textContent)).toEqual([
            'English',
            'Français',
            'Español',
            'Deutsch',
        ]);
    });

    it('marks the language of the member', () => {
        renderWithProviders(<LanguageField />);

        expect(
            options().map((option) => option.getAttribute('aria-checked')),
        ).toEqual(['false', 'true', 'false', 'false']);
    });

    it('says what the setting does and what guests get', () => {
        renderWithProviders(<LanguageField />);

        expect(
            screen.getByText(
                'Interface language. Guests follow their browser.',
            ),
        ).toBeTruthy();
    });

    it('saves the chosen language at once, without moving the page', () => {
        renderWithProviders(<LanguageField />);

        fireEvent.click(screen.getByRole('radio', { name: 'Deutsch' }));

        expect(mocks.put).toHaveBeenCalledWith(
            '/locale',
            { locale: 'de' },
            { preserveScroll: true },
        );
    });

    it('sends nothing when the current language is pressed again', () => {
        renderWithProviders(<LanguageField />);

        fireEvent.click(screen.getByRole('radio', { name: 'Français' }));

        expect(mocks.put).not.toHaveBeenCalled();
    });
});
