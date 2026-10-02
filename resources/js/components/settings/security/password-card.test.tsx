import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFormState } from '@/test/inertia-form';
import { renderWithProviders } from '@/test/render';
import { PasswordCard } from './password-card';

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
    Object.assign(form, createFormState());
});

function field(label: string): HTMLInputElement {
    return screen.getByLabelText(label) as HTMLInputElement;
}

describe('PasswordCard', () => {
    it('keeps the ids, the names and the save hook of the old form', () => {
        const { container } = renderWithProviders(
            <PasswordCard passwordRules="minlength: 8;" />,
        );

        expect(field('Current password').id).toBe('current_password');
        expect(field('Current password').name).toBe('current_password');
        expect(field('Current password').autocomplete).toBe('current-password');
        expect(field('New password').id).toBe('password');
        expect(field('New password').name).toBe('password');
        expect(field('New password').getAttribute('passwordrules')).toBe(
            'minlength: 8;',
        );
        expect(field('Confirm new password').id).toBe('password_confirmation');
        expect(field('Confirm new password').name).toBe(
            'password_confirmation',
        );
        expect(
            screen
                .getByRole('button', { name: 'Update password' })
                .getAttribute('data-test'),
        ).toBe('update-password-button');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/settings/password?_method=PUT',
        );
        expect(form.props.resetOnError).toEqual([
            'password',
            'password_confirmation',
            'current_password',
        ]);
        expect(form.props.resetOnSuccess).toBe(true);
    });

    it('can show each of the three passwords', async () => {
        renderWithProviders(<PasswordCard passwordRules="minlength: 8;" />);

        expect(
            screen.getAllByRole('button', { name: 'Show password' }).length,
        ).toBe(3);
    });

    it('measures the new password as it is typed and states the rule of the server', async () => {
        renderWithProviders(<PasswordCard passwordRules="minlength: 12;" />);

        await userEvent.type(field('New password'), 'abcdefghijklmn');

        expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
            'Good',
        );
        expect(
            screen.getByRole('list', { name: 'Password rules' }).textContent,
        ).toBe('At least 12 characters(met)');
        expect(screen.queryByText(/data breaches/)).toBeNull();
    });

    it('marks the confirmation once it matches the new password', async () => {
        renderWithProviders(<PasswordCard passwordRules="minlength: 8;" />);

        await userEvent.type(field('New password'), 'correct horse');
        await userEvent.type(field('Confirm new password'), 'correct');

        expect(
            screen.queryByRole('img', { name: 'Passwords match' }),
        ).toBeNull();

        await userEvent.type(field('Confirm new password'), ' horse');

        expect(
            screen.getByRole('img', { name: 'Passwords match' }),
        ).toBeTruthy();
    });

    it('shows a refusal under its field', () => {
        form.errors = { current_password: 'The password is incorrect.' };
        renderWithProviders(<PasswordCard passwordRules="minlength: 8;" />);

        expect(
            document.getElementById('current_password-error')?.textContent,
        ).toBe('The password is incorrect.');
        expect(field('Current password').getAttribute('aria-invalid')).toBe(
            'true',
        );
    });

    it('empties the new password and focuses the refused field after an error', async () => {
        renderWithProviders(<PasswordCard passwordRules="minlength: 8;" />);

        await userEvent.type(field('New password'), 'short');
        await userEvent.type(field('Confirm new password'), 'short');

        act(() =>
            (form.props.onError as (errors: Record<string, string>) => void)({
                current_password: 'The password is incorrect.',
            }),
        );

        expect(field('New password').value).toBe('');
        expect(field('Confirm new password').value).toBe('');
        expect(document.activeElement?.id).toBe('current_password');
    });

    it('empties the fields and the meter once the password is changed', async () => {
        renderWithProviders(<PasswordCard passwordRules="minlength: 8;" />);

        await userEvent.type(field('New password'), 'abcdefghijklmn');

        act(() => (form.props.onSuccess as () => void)());

        expect(field('New password').value).toBe('');
        expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe(
            '0',
        );
    });

    it('disables the button while the password is saved', () => {
        form.processing = true;
        renderWithProviders(<PasswordCard passwordRules="minlength: 8;" />);

        expect(
            screen
                .getByRole('button', { name: 'Update password' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it('leaves the end of the rules to the breach check', () => {
        renderWithProviders(
            <PasswordCard
                passwordRules="minlength: 8;"
                breachCheck={<li>Not found in known data breaches</li>}
            />,
        );

        expect(
            screen.getByRole('list', { name: 'Password rules' })
                .lastElementChild?.textContent,
        ).toBe('Not found in known data breaches');
    });
});
