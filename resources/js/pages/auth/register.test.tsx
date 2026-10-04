import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import Register from './register';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        Form: formMock(form),
        Head: () => null,
    };
});

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

beforeEach(() => {
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

function renderPage(asksTeamName: boolean) {
    return renderWithProviders(
        <Register
            passwordRules=""
            invitationEmail={null}
            asksTeamName={asksTeamName}
            ssoProviders={[]}
        />,
    );
}

describe('auth/register page', () => {
    it('reads "Create your workspace" when the account will found one', () => {
        renderPage(true);

        expect(
            screen.getByRole('heading', { name: 'Create your workspace' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Your team gets a space for its retros, poker and icebreakers.',
            ),
        ).toBeTruthy();
        expect(screen.getByLabelText('Team name')).toBeTruthy();
    });

    it('keeps "Create your account" when an invitation or a link brings the account', () => {
        renderPage(false);

        expect(
            screen.getByRole('heading', { name: 'Create your account' }),
        ).toBeTruthy();
        expect(
            screen.getByText('Enter your details below to create your account'),
        ).toBeTruthy();
        expect(screen.queryByLabelText('Team name')).toBeNull();
    });
});
