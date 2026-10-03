import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { EmailFallbackRow } from './email-fallback-row';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

describe('EmailFallbackRow', () => {
    it('draws the fallback switch on and locked, explained by the password way back', () => {
        renderWithProviders(<EmailFallbackRow />);

        const fallback = screen.getByRole('switch', {
            name: 'Keep sign-in by e-mail as fallback',
        });

        expect(fallback.getAttribute('aria-checked')).toBe('true');
        expect((fallback as HTMLButtonElement).disabled).toBe(true);

        const help = (fallback.getAttribute('aria-describedby') ?? '')
            .split(' ')
            .map((id) => document.getElementById(id)?.textContent);

        expect(help).toContain(
            'Instance admins can always sign in with their password.',
        );
        expect(
            screen.getByText('For the admin if the provider is unavailable.'),
        ).not.toBeNull();
    });
});
