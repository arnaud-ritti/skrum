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

    it('shows the same panel on a rebranded instance, without its name or its logo', () => {
        withBrand({
            ...skrum,
            name: 'Acme',
            logoLightUrl: '/brand/logo-light?v=1',
        });
        const { container } = renderWithProviders(<BrandAside />);
        const aside = container.querySelector('[data-slot="auth-aside"]');

        expect(aside?.textContent).toContain('Meetings end, actions stay.');
        expect(aside?.textContent).not.toContain('Acme');
        expect(
            screen.queryByRole('img', { name: 'Acme', hidden: true }),
        ).toBeNull();
        expect(container.querySelector('img[src*="/brand/"]')).toBeNull();
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
