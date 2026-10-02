import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthAside } from '@/components/auth/auth-aside';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { translations: {} };
});

describe('AuthAside', () => {
    it('is decorative: hidden from assistive technology and inert', () => {
        renderWithProviders(<AuthAside />);

        const aside = document.querySelector('[data-slot="auth-aside"]');

        expect(aside?.getAttribute('aria-hidden')).toBe('true');
        expect(aside?.hasAttribute('inert')).toBe(true);
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('heading')).toBeNull();
    });

    it('carries the promise, two retro cards and one action', () => {
        renderWithProviders(<AuthAside />);

        const aside = document.querySelector('[data-slot="auth-aside"]');

        expect(aside?.textContent).toContain('Meetings end, actions remain.');
        expect(aside?.textContent).toContain('Open source · self-hostable');
        expect(aside?.querySelectorAll('article')).toHaveLength(2);
        expect(
            aside?.querySelectorAll('[data-slot="action-item"]'),
        ).toHaveLength(1);
    });

    it('keeps its cards out of the ids a board uses', () => {
        renderWithProviders(<AuthAside />);

        expect(document.querySelector('[id^="card-"]')).toBeNull();
    });
});
