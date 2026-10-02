import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import SessionEnded from './session-ended';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const head = vi.hoisted(() => ({ title: '' }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    Head: ({ title }: { title: string }) => {
        head.title = title;

        return null;
    },
}));

beforeEach(() => {
    head.title = '';
    page.props = {
        translations: {},
        locale: 'en',
        locales: ['en'],
        errors: {},
        brand: {
            name: 'Skrüm',
            logoLightUrl: null,
            logoDarkUrl: null,
            faviconUrl: null,
            poweredBy: true,
        },
    };
});

describe('retros/session-ended page', () => {
    it('tells the session has ended, what a guest does, and links to the login page', () => {
        renderWithProviders(<SessionEnded />);

        expect(head.title).toBe('Your session has ended.');
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Your session has ended.',
            }),
        ).toBeTruthy();
        expect(
            screen.getByText('Guests: ask the facilitator for the guest link.'),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Log in' }).getAttribute('href'),
        ).toBe('/login');
        expect(
            document.querySelector('[data-slot="access-notice"]'),
        ).not.toBeNull();
    });
});
