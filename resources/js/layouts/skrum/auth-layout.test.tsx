import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthLayout from '@/layouts/skrum/auth-layout';
import OnboardingLayout from '@/layouts/skrum/onboarding-layout';
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
    page.props = { translations: {}, locale: 'en', locales: ['en'], brand };
}

describe('AuthLayout', () => {
    it('shows the Skrüm logo and no credit line without a custom brand', () => {
        withBrand(skrum);
        renderWithProviders(
            <AuthLayout title="Log in">
                <p>form</p>
            </AuthLayout>,
        );

        expect(screen.getAllByRole('img', { name: 'Skrüm' })[0].tagName).toBe(
            'svg',
        );
        expect(screen.queryByRole('contentinfo')).toBeNull();
    });

    it('shows the instance logo and credits Skrüm for a custom brand', () => {
        withBrand({
            ...skrum,
            name: 'Acme',
            logoLightUrl: '/brand/logo-light?v=1',
        });
        renderWithProviders(
            <AuthLayout title="Log in">
                <p>form</p>
            </AuthLayout>,
        );

        const logo = screen.getByRole('img', { name: 'Acme' });

        expect(logo.getAttribute('src')).toBe('/brand/logo-light?v=1');
        expect(logo.className).toContain('h-12');
        expect(screen.getByRole('contentinfo').textContent).toBe(
            'Powered by Skrüm',
        );
    });

    it('hides the credit when the admin switched it off', () => {
        withBrand({ ...skrum, name: 'Acme', poweredBy: false });
        renderWithProviders(
            <AuthLayout title="Log in">
                <p>form</p>
            </AuthLayout>,
        );

        expect(screen.queryByRole('contentinfo')).toBeNull();
    });
});

describe('OnboardingLayout', () => {
    it('shows the instance logo in the header', () => {
        withBrand({
            ...skrum,
            name: 'Acme',
            logoLightUrl: '/brand/logo-light?v=1',
            logoDarkUrl: '/brand/logo-dark?v=2',
        });
        renderWithProviders(
            <OnboardingLayout>
                <p>step</p>
            </OnboardingLayout>,
        );

        const logos = screen.getAllByRole('img', { name: 'Acme' });

        expect(logos.map((logo) => logo.getAttribute('src'))).toEqual([
            '/brand/logo-light?v=1',
            '/brand/logo-dark?v=2',
        ]);
        expect(logos[0].className).toContain('h-7');
    });
});
