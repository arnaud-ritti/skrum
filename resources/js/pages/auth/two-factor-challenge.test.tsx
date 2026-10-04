import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TwoFactorChallenge from './two-factor-challenge';

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onFinish?: () => void;
};

const page = vi.hoisted(() => ({
    props: {} as Record<string, unknown>,
    post: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => page,
        Head: () => null,
        router: { ...original.router, post: page.post },
    };
});

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

beforeEach(() => {
    page.post.mockReset();
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

function renderChallenge() {
    renderWithProviders(
        <TwoFactorChallenge
            methods={['totp', 'email']}
            emailCode={{
                sentTo: 'a***@example.com',
                resendIn: 0,
                available: true,
            }}
        />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use an e-mail code' }));
}

describe('TwoFactorChallenge', () => {
    it('asks for the e-mail code once the code was sent', () => {
        page.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onStart?.();
                options.onSuccess?.();
                options.onFinish?.();
            },
        );

        renderChallenge();

        expect(
            screen.getByRole('button', { name: 'Use the authenticator app' }),
        ).toBeTruthy();
    });

    it('stays on the app code when sending the e-mail code failed', () => {
        page.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onStart?.();
                options.onFinish?.();
            },
        );

        renderChallenge();

        expect(
            screen.getByRole('button', { name: 'Use an e-mail code' }),
        ).toBeTruthy();
    });
});
