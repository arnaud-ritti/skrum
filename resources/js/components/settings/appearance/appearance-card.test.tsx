import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AppearanceCard } from './appearance-card';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const appearance = vi.hoisted(() => ({
    value: 'system' as 'system' | 'light' | 'dark',
    update: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { put: vi.fn() },
}));

vi.mock('@/hooks/use-appearance', () => ({
    useAppearance: () => ({
        appearance: appearance.value,
        resolvedAppearance: 'light',
        updateAppearance: appearance.update,
    }),
}));

beforeEach(() => {
    appearance.value = 'system';
    appearance.update.mockReset();
    page.props = { translations: {}, locale: 'en', locales: ['en', 'fr'] };
});

describe('AppearanceCard', () => {
    it('is the Appearance region and says where each setting is kept', () => {
        renderWithProviders(<AppearanceCard />);

        expect(
            screen.getByRole('region', { name: 'Appearance' }).textContent,
        ).toContain(
            'The theme is kept on this device. The language is saved on your account.',
        );
    });

    it('shows the stored theme and applies the chosen one', () => {
        appearance.value = 'light';
        renderWithProviders(<AppearanceCard />);

        expect(
            screen
                .getByRole('radio', { name: 'Light' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

        expect(appearance.update).toHaveBeenCalledWith('dark');
    });

    it('puts the language under the theme', () => {
        renderWithProviders(<AppearanceCard />);

        const theme = screen.getByRole('radiogroup', { name: 'Theme' });
        const language = screen.getByRole('radiogroup', { name: 'Language' });

        expect(
            theme.compareDocumentPosition(language) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('renders nothing in the places left for "Reduce animations" and the Accessibility card', () => {
        const { container } = renderWithProviders(<AppearanceCard />);

        expect(
            document.querySelector(
                '[data-slot="appearance-reduce-animations"]',
            ),
        ).toBeNull();
        expect(
            container.querySelectorAll('[data-slot="settings-card"]').length,
        ).toBe(1);
        expect(
            document.querySelectorAll('[data-slot="separator-root"]').length,
        ).toBe(1);
    });

    it('fills the places when a later feature gives them: the row under the language, the card under the Appearance card', () => {
        const { container } = renderWithProviders(
            <AppearanceCard
                reduceAnimations={<p>reduce</p>}
                accessibility={<section>accessibility</section>}
            />,
        );

        const row = document.querySelector(
            '[data-slot="appearance-reduce-animations"]',
        );

        expect(row?.textContent).toBe('reduce');
        expect(
            screen.getByRole('region', { name: 'Appearance' }).contains(row),
        ).toBe(true);
        expect(container.lastElementChild?.textContent).toBe('accessibility');
        expect(
            document.querySelectorAll('[data-slot="separator-root"]').length,
        ).toBe(2);
    });
});
