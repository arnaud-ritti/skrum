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

    it('shows the brand logo only on a rebranded instance', () => {
        withBrand({
            ...skrum,
            name: 'Acme',
            logoLightUrl: '/brand/logo-light?v=1',
        });
        const { container } = renderWithProviders(<BrandAside />);

        expect(container.querySelector('[data-slot="auth-aside"]')).toBeNull();
        expect(
            screen.getByRole('img', { name: 'Acme' }).getAttribute('src'),
        ).toBe('/brand/logo-light?v=1');
        expect(container.textContent).toBe('');
    });

    it('shows the name of a rebranded instance that has no logo', () => {
        withBrand({ ...skrum, name: 'Acme' });
        const { container } = renderWithProviders(<BrandAside />);

        expect(container.querySelector('[data-slot="auth-aside"]')).toBeNull();
        expect(container.textContent).toBe('Acme');
    });

    it('still hides the promise when the credit line is switched off', () => {
        withBrand({ ...skrum, name: 'Acme', poweredBy: false });
        const { container } = renderWithProviders(<BrandAside />);

        expect(container.querySelector('[data-slot="auth-aside"]')).toBeNull();
    });
});
