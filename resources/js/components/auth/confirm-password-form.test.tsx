import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmPasswordForm } from '@/components/auth/confirm-password-form';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
}));
const passkey = vi.hoisted(() => ({
    verify: vi.fn(),
    isLoading: false,
    error: null as string | null,
    isSupported: true,
    options: undefined as
        | undefined
        | { routes?: { options: string; submit: string } },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        Form: formMock(form),
    };
});

vi.mock('@laravel/passkeys/react', () => ({
    usePasskeyVerify: (options: typeof passkey.options) => {
        passkey.options = options;

        return passkey;
    },
}));

beforeEach(() => {
    page.props = { translations: {} };
    form.processing = false;
    form.errors = {};
    form.props = {};
    passkey.isLoading = false;
    passkey.isSupported = true;
    passkey.options = undefined;
});

describe('ConfirmPasswordForm', () => {
    it('keeps the id, the name and the submit hook of the old form', () => {
        const { container } = renderWithProviders(<ConfirmPasswordForm />);

        const password = screen.getByLabelText('Password');

        expect(password.id).toBe('password');
        expect(password.getAttribute('name')).toBe('password');
        expect(password.getAttribute('type')).toBe('password');
        expect(password.getAttribute('autocomplete')).toBe('current-password');
        expect(
            screen
                .getByRole('button', { name: 'Confirm password' })
                .getAttribute('data-test'),
        ).toBe('confirm-password-button');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/user/confirm-password',
        );
        expect(form.props.resetOnSuccess).toEqual(['password']);
    });

    it('offers the passkey confirmation above the password, on the confirmation routes', () => {
        const { container } = renderWithProviders(<ConfirmPasswordForm />);

        const passkeyButton = screen.getByRole('button', {
            name: 'Confirm with passkey',
        });

        expect(screen.getByText('Or confirm with password')).toBeTruthy();
        expect(passkey.options?.routes).toEqual({
            options: '/passkeys/confirm/options',
            submit: '/passkeys/confirm',
        });
        expect(
            passkeyButton.compareDocumentPosition(
                container.querySelector('form')!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('names the passkey button "Confirming..." while it waits', () => {
        passkey.isLoading = true;
        renderWithProviders(<ConfirmPasswordForm />);

        expect(
            screen.getByRole('button', { name: 'Confirming...' }),
        ).toBeTruthy();
    });

    it('shows the password alone without WebAuthn', () => {
        passkey.isSupported = false;
        renderWithProviders(<ConfirmPasswordForm />);

        expect(
            screen.queryByRole('button', { name: 'Confirm with passkey' }),
        ).toBeNull();
        expect(screen.queryByText('Or confirm with password')).toBeNull();
        expect(screen.getByLabelText('Password')).toBeTruthy();
    });

    it('shows the server error under the field', () => {
        form.errors = { password: 'The provided password was incorrect.' };
        renderWithProviders(<ConfirmPasswordForm />);

        expect(document.getElementById('password-error')?.textContent).toBe(
            'The provided password was incorrect.',
        );
    });
});
