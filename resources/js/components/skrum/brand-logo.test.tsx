import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandLogo } from '@/components/skrum/brand-logo';

const fallback = <span data-testid="fallback" />;

describe('BrandLogo', () => {
    it('shows the fallback when no brand is given', () => {
        render(<BrandLogo fallback={fallback} />);

        expect(screen.getByTestId('fallback')).toBeTruthy();
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('shows the fallback when the brand has no logo', () => {
        render(
            <BrandLogo
                brand={{ name: 'Acme', logoLightUrl: null, logoDarkUrl: null }}
                fallback={fallback}
            />,
        );

        expect(screen.getByTestId('fallback')).toBeTruthy();
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('shows the light logo on a card pill in the dark theme when there is no dark logo', () => {
        render(
            <BrandLogo
                brand={{
                    name: 'Acme',
                    logoLightUrl: '/brand/logo-light?v=1',
                    logoDarkUrl: null,
                }}
                className="h-7"
                fallback={fallback}
            />,
        );

        const logo = screen.getByRole('img', { name: 'Acme' });

        expect(logo.tagName).toBe('IMG');
        expect(logo.getAttribute('src')).toBe('/brand/logo-light?v=1');
        expect(logo.className).toContain('h-7');
        expect(logo.className).toContain('dark:bg-card');
        expect(logo.className).not.toContain('dark:hidden');
        expect(screen.queryByTestId('fallback')).toBeNull();
    });

    it('swaps the light logo for the dark one in the dark theme', () => {
        render(
            <BrandLogo
                brand={{
                    name: 'Acme',
                    logoLightUrl: '/brand/logo-light?v=1',
                    logoDarkUrl: '/brand/logo-dark?v=2',
                }}
                className="h-12"
                fallback={fallback}
            />,
        );

        const [light, dark] = screen.getAllByRole('img', { name: 'Acme' });

        expect(light.getAttribute('src')).toBe('/brand/logo-light?v=1');
        expect(light.className).toContain('dark:hidden');
        expect(light.className).not.toContain('dark:bg-card');
        expect(dark.getAttribute('src')).toBe('/brand/logo-dark?v=2');
        expect(dark.className).toContain('hidden');
        expect(dark.className).toContain('dark:block');
        expect(dark.className).toContain('h-12');
    });
});
