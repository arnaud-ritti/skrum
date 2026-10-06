import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrandAside } from '@/components/auth/brand-aside';
import { renderWithProviders } from '@/test/render';
import type { Brand } from '@/types';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

const skrum: Brand = {
    name: 'Skrüm',
    logoLightUrl: null,
    logoDarkUrl: null,
    faviconUrl: null,
    poweredBy: true,
};

function withBrand(brand: Brand) {
    page.props = { translations: {}, brand };
}

describe('BrandAside', () => {
    it('shows the promise and the sample notes on a Skrüm instance', () => {
        withBrand(skrum);
        const { container } = renderWithProviders(<BrandAside />);

        expect(container.querySelector('[data-slot="auth-aside"]')).not.toBe(
            null,
        );
        expect(container.querySelector('[data-slot="brand-aside"]')).toBeNull();
    });

    it('shows the logo of a rebranded instance above the promise', () => {
        withBrand({
            ...skrum,
            name: 'Acme',
            logoLightUrl: '/brand/logo-light?v=1',
        });
        const { container } = renderWithProviders(<BrandAside />);
        const aside = container.querySelector('[data-slot="auth-aside"]');
        const mark = container.querySelector('[data-slot="brand-aside"]');

        expect(aside).not.toBeNull();
        expect(aside?.textContent).toContain('Meetings end, actions stay.');
        expect(
            screen
                .getByRole('img', { name: 'Acme', hidden: true })
                .getAttribute('src'),
        ).toBe('/brand/logo-light?v=1');
        expect(
            mark?.compareDocumentPosition(
                screen.getByText('Meetings end, actions stay.'),
            ),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('shows the name of a rebranded instance that has no logo, above the promise', () => {
        withBrand({ ...skrum, name: 'Acme' });
        const { container } = renderWithProviders(<BrandAside />);

        expect(
            container.querySelector('[data-slot="brand-aside"]')?.textContent,
        ).toBe('Acme');
        expect(
            container.querySelectorAll('[data-slot="auth-aside-note"]'),
        ).toHaveLength(3);
    });

    it('shows the promise whether the credit line is on or off', () => {
        withBrand({ ...skrum, name: 'Acme', poweredBy: false });
        const { container } = renderWithProviders(<BrandAside />);

        expect(container.querySelector('[data-slot="auth-aside"]')).not.toBe(
            null,
        );
    });
});
