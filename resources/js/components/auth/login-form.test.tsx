import { fireEvent, screen, within } from '@testing-library/react';
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
const viewport = vi.hoisted(() => ({ isPhone: false }));
const post = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        router: { post },
        Form: formMock(form),
    };
});

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => viewport.isPhone,
}));

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
    viewport.isPhone = false;
    post.mockReset();
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

    it('offers no magic link when the instance cannot send one', () => {
        viewport.isPhone = true;
        const { container } = renderForm();

        expect(
            container.querySelector('[data-slot="login-method-tabs"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-slot="login-magic-link"]'),
        ).toBeNull();
    });

    it('does not print the raw status of a requested magic link', () => {
        renderForm({ status: 'magic-link-sent', canUseMagicLink: true });

        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.queryByText('magic-link-sent')).toBeNull();
    });

    it('puts the magic link button after the log in button and before the register link', () => {
        const { container } = renderForm({ canUseMagicLink: true });

        const submit = screen.getByRole('button', { name: 'Log in' });
        const magic = screen.getByRole('button', {
            name: 'E-mail me a magic link instead',
        });
        const registerLink = screen.getByRole('link', {
            name: 'Create an account',
        });

        expect(
            container.querySelector('[data-slot="login-method-tabs"]'),
        ).toBeNull();
        expect(
            submit.compareDocumentPosition(magic) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            magic.compareDocumentPosition(registerLink) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('sends the link to the address typed in the e-mail field and reports it', () => {
        const onMagicLinkSent = vi.fn();

        renderForm({ canUseMagicLink: true, onMagicLinkSent });
        fireEvent.change(screen.getByLabelText('Work email'), {
            target: { value: 'ada@example.test' },
        });
        fireEvent.click(
            screen.getByRole('button', {
                name: 'E-mail me a magic link instead',
            }),
        );

        expect(post.mock.calls[0][1]).toEqual({ email: 'ada@example.test' });

        post.mock.calls[0][2].onSuccess();

        expect(onMagicLinkSent).toHaveBeenCalledWith('ada@example.test');
    });

    it('asks for the address under the field when none was typed', () => {
        renderForm({ canUseMagicLink: true });
        fireEvent.click(
            screen.getByRole('button', {
                name: 'E-mail me a magic link instead',
            }),
        );

        const email = screen.getByLabelText('Work email');

        expect(post).not.toHaveBeenCalled();
        expect(document.getElementById('email-error')?.textContent).toBe(
            'Enter your e-mail address first.',
        );
        expect(document.activeElement).toBe(email);

        fireEvent.change(email, { target: { value: 'a' } });

        expect(document.getElementById('email-error')).toBeNull();
    });

    it('opens a phone on the password form, with the two methods as tabs and no ghost button', () => {
        viewport.isPhone = true;
        renderForm({ canUseMagicLink: true });

        const tabs = within(
            screen.getByRole('tablist', { name: 'Sign-in method' }),
        ).getAllByRole('tab');

        expect(tabs.map((tab) => tab.textContent)).toEqual([
            'Magic link',
            'Password',
        ]);
        expect(tabs[1].getAttribute('aria-selected')).toBe('true');
        expect(screen.getByLabelText('Password').id).toBe('password');
        expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
        expect(
            screen.queryByRole('button', {
                name: 'E-mail me a magic link instead',
            }),
        ).toBeNull();
    });

    it('folds the password form under "Administrator sign-in" when single sign-on is required', () => {
        passkey.isSupported = true;
        const { container } = renderForm({
            ssoRequired: true,
            canUseMagicLink: true,
            ssoProviders: [{ key: 'oidc', label: 'Nordlys SSO' }],
        });

        const sso = container.querySelector('[data-slot="sso-buttons"]')!;
        const sentence = screen.getByText(
            'This instance signs in with single sign-on only.',
        );
        const disclosure = screen.getByRole('button', {
            name: 'Administrator sign-in',
        });

        expect(sso.nextElementSibling).toBe(sentence);
        expect(
            sentence.compareDocumentPosition(disclosure) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(disclosure.getAttribute('aria-expanded')).toBe('false');
        expect(document.getElementById('email')).toBeNull();
        expect(document.getElementById('password')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
        expect(
            container.querySelector('[data-slot="auth-separator"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-slot="passkey-sign-in"]'),
        ).toBeNull();

        fireEvent.click(disclosure);

        expect(document.activeElement).toBe(document.getElementById('email'));
        expect(screen.getByLabelText('Password').id).toBe('password');
        expect(
            screen.getByRole('link', { name: 'Forgot your password?' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('button', { name: 'Log in' })
                .getAttribute('data-test'),
        ).toBe('login-button');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/login',
        );
        expect(screen.queryByLabelText('Remember me')).toBeNull();
    });

    it.each([false, true])(
        'never offers a magic link nor a registration when single sign-on is required (phone: %s)',
        (isPhone) => {
            viewport.isPhone = isPhone;
            const { container } = renderForm({
                ssoRequired: true,
                canUseMagicLink: true,
                canRegister: true,
                ssoProviders: [{ key: 'oidc', label: 'Nordlys SSO' }],
            });

            fireEvent.click(
                screen.getByRole('button', { name: 'Administrator sign-in' }),
            );

            expect(
                container.querySelector('[data-test="magic-link-button"]'),
            ).toBeNull();
            expect(
                container.querySelector('[data-slot="login-method-tabs"]'),
            ).toBeNull();
            expect(
                screen.queryByRole('link', { name: 'Create an account' }),
            ).toBeNull();
        },
    );
});
