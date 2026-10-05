import { screen, within } from '@testing-library/react';
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

describe('AuthLayout centred', () => {
    it('passes the variant to the frame', () => {
        withBrand(skrum);
        const { container } = renderWithProviders(
            <AuthLayout variant="centered" title="Sprint 42 retro">
                <p>card</p>
            </AuthLayout>,
        );

        expect(
            screen
                .getByRole('heading', { level: 1, name: 'Sprint 42 retro' })
                .classList.contains('sr-only'),
        ).toBe(true);
        expect(container.querySelector('aside')).toBeNull();
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

    it('ends the header with the language, the account and "Log out"', () => {
        withBrand(skrum);
        page.props.auth = {
            user: { id: 'u1', name: 'Nadia Benali', avatarUrl: '' },
        };
        renderWithProviders(
            <OnboardingLayout>
                <p>step</p>
            </OnboardingLayout>,
        );

        const banner = within(screen.getByRole('banner'));

        expect(banner.getByRole('combobox', { name: 'Language' })).toBeTruthy();
        expect(banner.getByText('NB')).toBeTruthy();
        expect(banner.getByRole('button', { name: 'Log out' })).toBeTruthy();
    });

    it('leaves the account and "Log out" out for a signed-out visitor', () => {
        withBrand(skrum);
        page.props.auth = { user: null };
        renderWithProviders(
            <OnboardingLayout>
                <p>step</p>
            </OnboardingLayout>,
        );

        expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    });
});
