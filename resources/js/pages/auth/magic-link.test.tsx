import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import MagicLink from './magic-link';

const page = vi.hoisted(() => ({
    props: {} as Record<string, unknown>,
    title: '',
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    Head: ({ title }: { title: string }) => {
        page.title = title;

        return null;
    },
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

beforeEach(() => {
    page.title = '';
    page.props = {
        translations: {},
        locale: 'en',
        locales: ['en'],
        brand: {
            name: 'Skrüm',
            logoLightUrl: null,
            logoDarkUrl: null,
            faviconUrl: null,
            poweredBy: true,
        },
    };
});

describe('MagicLink', () => {
    it('names the page after the sign in while the link works', () => {
        renderWithProviders(
            <MagicLink email="ada@example.com" confirmUrl="/magic/confirm" />,
        );

        expect(page.title).toBe('Sign in');
    });

    it('names the page after the dead link once it no longer works', () => {
        renderWithProviders(<MagicLink email={null} confirmUrl={null} />);

        expect(page.title).toBe('This link no longer works');
    });
});
