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

    it('shows the promise and three notes, and no badge', () => {
        renderWithProviders(<AuthAside />);

        const aside = document.querySelector('[data-slot="auth-aside"]');

        expect(aside?.textContent).toContain('Meetings end, actions stay.');
        expect(aside?.textContent).not.toContain('Open source');
        expect(aside?.querySelector('[data-slot="badge"]')).toBeNull();
        expect(aside?.querySelectorAll('article')).toHaveLength(2);
        expect(
            aside?.querySelectorAll('[data-slot="action-item"]'),
        ).toHaveLength(1);
    });

    it('floats each note on its own wrapper and stops with reduced motion', () => {
        renderWithProviders(<AuthAside />);

        const wrappers = Array.from(
            document.querySelectorAll('[data-slot="auth-aside-note"]'),
        );
        const notes = wrappers.map((wrapper) => wrapper.firstElementChild);

        expect(wrappers).toHaveLength(3);

        for (const wrapper of wrappers) {
            expect(wrapper.children).toHaveLength(1);
            expect(wrapper.className).toContain('animate-float');
            expect(wrapper.className).toContain('motion-reduce:animate-none');
            expect(wrapper.className).not.toContain('rotate');
        }

        expect(
            new Set(
                wrappers.map(
                    (wrapper) =>
                        wrapper.className.match(
                            /\[animation-delay:[^\]]+\]/,
                        )?.[0],
                ),
            ).size,
        ).toBe(3);

        for (const note of notes) {
            expect(note?.className).toContain('rotate');
            expect(note?.className).toContain('shadow-raised');
        }
    });

    it('keeps its cards out of the ids a board uses', () => {
        renderWithProviders(<AuthAside />);

        expect(document.querySelector('[id^="card-"]')).toBeNull();
    });
});
