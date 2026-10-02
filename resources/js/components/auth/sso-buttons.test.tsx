import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SsoButtons } from '@/components/auth/sso-buttons';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { translations: {} };
});

describe('SsoButtons', () => {
    it('renders nothing without a provider', () => {
        const { container } = renderWithProviders(
            <SsoButtons providers={[]} />,
        );

        expect(container.innerHTML).toBe('');
    });

    it('links each provider to its redirect, as a full navigation', () => {
        renderWithProviders(
            <SsoButtons
                providers={[
                    { key: 'oidc', label: 'Nordlys SSO' },
                    { key: 'google', label: 'Google' },
                    { key: 'github', label: 'GitHub' },
                    { key: 'entra', label: 'Microsoft' },
                ]}
            />,
        );

        const links = screen.getAllByRole('link');

        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/auth/oidc/redirect',
            '/auth/entra/redirect',
            '/auth/google/redirect',
            '/auth/github/redirect',
        ]);
        expect(
            screen.getByRole('link', { name: 'Continue with Nordlys SSO' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Continue with Google' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Continue with GitHub' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Continue with Microsoft' }),
        ).toBeTruthy();
    });

    it('puts the company sign-on first, whatever order the server sends', () => {
        renderWithProviders(
            <SsoButtons
                providers={[
                    { key: 'google', label: 'Google' },
                    { key: 'github', label: 'GitHub' },
                    { key: 'entra', label: 'Microsoft' },
                    { key: 'oidc', label: 'Nordlys SSO' },
                ]}
            />,
        );

        expect(
            screen
                .getAllByRole('link')
                .map((link) => link.getAttribute('href')),
        ).toEqual([
            '/auth/oidc/redirect',
            '/auth/entra/redirect',
            '/auth/google/redirect',
            '/auth/github/redirect',
        ]);
    });

    it('gives the first provider the full width and pairs the others', () => {
        renderWithProviders(
            <SsoButtons
                providers={[
                    { key: 'oidc', label: 'Nordlys SSO' },
                    { key: 'google', label: 'Google' },
                    { key: 'github', label: 'GitHub' },
                ]}
            />,
        );

        const pairs = document.querySelector('[data-slot="sso-buttons-more"]');

        expect(pairs?.querySelectorAll('a')).toHaveLength(2);
        expect(
            pairs?.contains(
                screen.getByRole('link', { name: 'Continue with Nordlys SSO' }),
            ),
        ).toBe(false);
    });

    it('has no second row for a single provider', () => {
        renderWithProviders(
            <SsoButtons providers={[{ key: 'google', label: 'Google' }]} />,
        );

        expect(
            document.querySelector('[data-slot="sso-buttons-more"]'),
        ).toBeNull();
    });

    it('ends with the separator that introduces the e-mail form', () => {
        renderWithProviders(
            <SsoButtons providers={[{ key: 'google', label: 'Google' }]} />,
        );

        expect(screen.getByText('or with your e-mail')).toBeTruthy();
    });
});
