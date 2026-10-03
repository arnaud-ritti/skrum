import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import JoinCode from './join-code';

const post = vi.hoisted(() => vi.fn());
const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const viewport = vi.hoisted(() => ({ isPhone: false }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { post },
    Head: () => null,
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => viewport.isPhone,
}));

beforeEach(() => {
    post.mockClear();
    viewport.isPhone = false;
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

describe('JoinCode page', () => {
    it('posts a valid code to the join route', () => {
        renderWithProviders(<JoinCode />);

        fireEvent.change(screen.getByLabelText('Session code'), {
            target: { value: 'k7qp4m2' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(post).toHaveBeenCalledWith(
            '/join',
            { code: 'K7Q-P4M2' },
            expect.anything(),
        );
    });

    it('does not post a short code', () => {
        renderWithProviders(<JoinCode />);

        fireEvent.change(screen.getByLabelText('Session code'), {
            target: { value: 'k7q' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(post).not.toHaveBeenCalled();
        expect(screen.getByText('The code has 8 characters')).toBeTruthy();
    });

    it('shows the server answer on the field', () => {
        page.props.errors = { code: 'No session matches this code.' };

        renderWithProviders(<JoinCode />);

        expect(screen.getByText('No session matches this code.')).toBeTruthy();
    });

    it('docks the button at the bottom on a phone', () => {
        viewport.isPhone = true;

        renderWithProviders(<JoinCode />);

        expect(
            document
                .querySelector('[data-slot="join-code-action"]')
                ?.className.includes('sticky'),
        ).toBe(true);
    });
});
