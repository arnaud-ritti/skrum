import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { renderWithProviders } from '@/test/render';

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
    };
});

beforeEach(() => {
    page.props = { translations: {} };
    form.processing = false;
    form.errors = {};
    form.props = {};
});

const rules = 'minlength: 12; required: lower;';

function renderForm(passwordRules = rules) {
    return renderWithProviders(
        <ResetPasswordForm
            token="reset-token"
            email="mona@example.com"
            passwordRules={passwordRules}
        />,
    );
}

describe('ResetPasswordForm', () => {
    it('keeps the ids, the names and the submit hook of the old form', () => {
        const { container } = renderForm();

        const email = screen.getByLabelText('Work email') as HTMLInputElement;
        const password = screen.getByLabelText('New password');
        const confirmation = screen.getByLabelText('Confirm password');

        expect(email.id).toBe('email');
        expect(email.value).toBe('mona@example.com');
        expect(email.readOnly).toBe(true);
        expect(password.id).toBe('password');
        expect(password.getAttribute('name')).toBe('password');
        expect(password.getAttribute('autocomplete')).toBe('new-password');
        expect(confirmation.id).toBe('password_confirmation');
        expect(confirmation.getAttribute('name')).toBe('password_confirmation');
        expect(
            screen
                .getByRole('button', { name: 'Reset password' })
                .getAttribute('data-test'),
        ).toBe('reset-password-button');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/reset-password',
        );
        expect(form.props.resetOnSuccess).toEqual([
            'password',
            'password_confirmation',
        ]);
    });

    it('sends the token and the e-mail of the link with the passwords', () => {
        renderForm();

        const transform = form.props.transform as (
            data: Record<string, unknown>,
        ) => Record<string, unknown>;

        expect(
            transform({ password: 'a', password_confirmation: 'a' }),
        ).toEqual({
            password: 'a',
            password_confirmation: 'a',
            token: 'reset-token',
            email: 'mona@example.com',
        });
    });

    it('gives the password rules of the server to both password fields', () => {
        renderForm();

        expect(
            screen.getByLabelText('New password').getAttribute('passwordrules'),
        ).toBe(rules);
        expect(
            screen
                .getByLabelText('Confirm password')
                .getAttribute('passwordrules'),
        ).toBe(rules);
        expect(
            screen.getByLabelText('New password').getAttribute('placeholder'),
        ).toBe('12 characters minimum');
    });

    it('states no minimum length when the server rule has none', () => {
        renderForm('');

        expect(
            screen.getByLabelText('New password').getAttribute('placeholder'),
        ).toBeNull();
    });

    it('shows each server error under its field', () => {
        form.errors = {
            email: 'This password reset token is invalid.',
            password: 'The password field confirmation does not match.',
        };
        renderForm();

        expect(document.getElementById('email-error')?.textContent).toBe(
            'This password reset token is invalid.',
        );
        expect(document.getElementById('password-error')?.textContent).toBe(
            'The password field confirmation does not match.',
        );
    });
});
