import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasskeySignIn } from '@/components/auth/passkey-sign-in';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const visit = vi.hoisted(() => vi.fn());
const passkey = vi.hoisted(() => ({
    verify: vi.fn(),
    isLoading: false,
    error: null as string | null,
    isSupported: true,
    options: undefined as
        | undefined
        | {
              routes?: { options: string; submit: string };
              onSuccess?: (response: { redirect?: string }) => void;
          },
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { visit },
}));

vi.mock('@laravel/passkeys/react', () => ({
    usePasskeyVerify: (options: typeof passkey.options) => {
        passkey.options = options;

        return passkey;
    },
}));

beforeEach(() => {
    page.props = { translations: {} };
    visit.mockClear();
    passkey.verify.mockClear();
    passkey.isLoading = false;
    passkey.error = null;
    passkey.isSupported = true;
    passkey.options = undefined;
});

describe('PasskeySignIn', () => {
    it('renders nothing when the browser has no WebAuthn', () => {
        passkey.isSupported = false;

        const { container } = renderWithProviders(<PasskeySignIn />);

        expect(container.innerHTML).toBe('');
    });

    it('starts the passkey check from its button', () => {
        renderWithProviders(<PasskeySignIn />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Sign in with a passkey' }),
        );

        expect(passkey.verify).toHaveBeenCalledTimes(1);
        expect(screen.getByText('or with your e-mail')).toBeTruthy();
    });

    it('is busy and named by the loading label while it checks', () => {
        passkey.isLoading = true;

        renderWithProviders(<PasskeySignIn />);

        const button = screen.getByRole('button', {
            name: 'Authenticating...',
        });

        expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('shows the error under the button', () => {
        passkey.error = 'The passkey was refused.';

        renderWithProviders(<PasskeySignIn />);

        expect(screen.getByRole('alert').textContent).toBe(
            'The passkey was refused.',
        );
    });

    it('takes its routes and labels from the caller', () => {
        renderWithProviders(
            <PasskeySignIn
                routes={{
                    options: {
                        url: '/passkeys/confirm/options',
                        method: 'get',
                    },
                    submit: { url: '/passkeys/confirm', method: 'post' },
                }}
                label="Confirm with passkey"
                loadingLabel="Confirming..."
                separator="Or confirm with password"
            />,
        );

        expect(passkey.options?.routes).toEqual({
            options: '/passkeys/confirm/options',
            submit: '/passkeys/confirm',
        });
        expect(
            screen.getByRole('button', { name: 'Confirm with passkey' }),
        ).toBeTruthy();
        expect(screen.getByText('Or confirm with password')).toBeTruthy();
        expect(screen.queryByText('or with your e-mail')).toBeNull();
    });

    it('goes where the server says after a success, or to the dashboard', () => {
        renderWithProviders(<PasskeySignIn />);

        passkey.options?.onSuccess?.({ redirect: '/teams/atlas' });
        passkey.options?.onSuccess?.({});

        expect(visit.mock.calls).toEqual([['/teams/atlas'], ['/dashboard']]);
    });
});
