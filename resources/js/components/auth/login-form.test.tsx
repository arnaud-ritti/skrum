import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/components/auth/login-form';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
}));
const passkey = vi.hoisted(() => ({ isSupported: false }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        Form: formMock(form),
    };
});

vi.mock('@laravel/passkeys/react', () => ({
    usePasskeyVerify: () => ({
        verify: vi.fn(),
        isLoading: false,
        error: null,
        isSupported: passkey.isSupported,
    }),
}));

beforeEach(() => {
    page.props = { translations: {} };
    form.processing = false;
    form.errors = {};
    form.props = {};
    passkey.isSupported = false;
});

function renderForm(props: Partial<Parameters<typeof LoginForm>[0]> = {}) {
    return renderWithProviders(
        <LoginForm canResetPassword canRegister ssoProviders={[]} {...props} />,
    );
}

describe('LoginForm', () => {
    it.each([
        ['providers and a passkey', true, true, 1],
        ['providers only', true, false, 1],
        ['a passkey only', false, true, 1],
        ['neither', false, false, 0],
    ])(
        'introduces the e-mail form once with %s',
        (_, withProviders, withPasskey, separators) => {
            passkey.isSupported = withPasskey;

            renderForm({
                ssoProviders: withProviders
                    ? [{ key: 'google', label: 'Google' }]
                    : [],
            });

            expect(screen.queryAllByText('or with your e-mail')).toHaveLength(
                separators,
            );
        },
    );

    it('keeps the ids, the names and the submit hook the walkthroughs sign in with', () => {
        const { container } = renderForm();

        const email = screen.getByLabelText('Work email');
        const password = screen.getByLabelText('Password');

        expect(email.id).toBe('email');
        expect(email.getAttribute('name')).toBe('email');
        expect(email.getAttribute('type')).toBe('email');
        expect(email.getAttribute('autocomplete')).toBe('email');
        expect(password.id).toBe('password');
        expect(password.getAttribute('name')).toBe('password');
        expect(password.getAttribute('autocomplete')).toBe('current-password');

        const submit = screen.getByRole('button', { name: 'Log in' });

        expect(submit.getAttribute('data-test')).toBe('login-button');
        expect(submit.getAttribute('type')).toBe('submit');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/login',
        );
        expect(form.props.resetOnSuccess).toEqual(['password']);
    });

    it('offers "Remember me" as a checkbox named remember', () => {
        renderForm();

        const remember = screen.getByRole('checkbox', { name: 'Remember me' });

        expect(remember.id).toBe('remember');
    });

    it('shows a server error under its field', () => {
        form.errors = {
            email: 'These credentials do not match our records.',
        };
        renderForm();

        const email = screen.getByLabelText('Work email');

        expect(email.getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById('email-error')?.textContent).toBe(
            'These credentials do not match our records.',
        );
    });

    it('disables the submit button while the request runs', () => {
        form.processing = true;
        renderForm();

        expect(
            screen
                .getByRole('button', { name: 'Log in' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it('links to the password reset only when it is enabled', () => {
        const { unmount } = renderForm();

        expect(
            screen
                .getByRole('link', { name: 'Forgot your password?' })
                .getAttribute('href'),
        ).toBe('/forgot-password');

        unmount();
        renderForm({ canResetPassword: false });

        expect(
            screen.queryByRole('link', { name: 'Forgot your password?' }),
        ).toBeNull();
    });

    it('links to the registration only when it is open', () => {
        const { unmount } = renderForm();

        expect(screen.getByText("Don't have an account?")).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Create an account' })
                .getAttribute('href'),
        ).toBe('/register');

        unmount();
        renderForm({ canRegister: false });

        expect(
            screen.queryByRole('link', { name: 'Create an account' }),
        ).toBeNull();
    });

    it('shows the status of a password reset as a success alert above the form', () => {
        const { container } = renderForm({
            status: 'Your password has been reset.',
        });

        const alert = screen.getByRole('status');

        expect(alert.textContent).toBe('Your password has been reset.');
        expect(
            alert.compareDocumentPosition(container.querySelector('form')!) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('puts the SSO buttons and the passkey button before the form', () => {
        passkey.isSupported = true;
        const { container } = renderForm({
            ssoProviders: [{ key: 'oidc', label: 'Nordlys SSO' }],
        });

        const sso = container.querySelector('[data-slot="sso-buttons"]')!;
        const passkeyButton = container.querySelector(
            '[data-slot="passkey-sign-in"]',
        )!;

        expect(
            within(sso as HTMLElement).getByRole('link', {
                name: 'Continue with Nordlys SSO',
            }),
        ).toBeTruthy();
        expect(sso.nextElementSibling).toBe(passkeyButton);
        expect(
            passkeyButton.compareDocumentPosition(
                container.querySelector('form')!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('renders nothing in the places left for the magic link', () => {
        const { container } = renderForm();

        expect(
            container.querySelector('[data-slot="login-method-tabs"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-slot="login-magic-link"]'),
        ).toBeNull();
    });

    it('fills the two places when a later feature gives them', () => {
        const { container } = renderForm({
            methodTabs: <div role="tablist" />,
            magicLink: <button type="button">Magic</button>,
        });

        const formElement = container.querySelector('form')!;
        const tabs = container.querySelector(
            '[data-slot="login-method-tabs"]',
        )!;
        const magic = container.querySelector(
            '[data-slot="login-magic-link"]',
        )!;

        expect(
            tabs.compareDocumentPosition(formElement) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            formElement.compareDocumentPosition(magic) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});
