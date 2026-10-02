import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordField } from '@/components/auth/password-field';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { translations: {} };
});

describe('PasswordField', () => {
    it('hides what is typed and forwards the field attributes', () => {
        renderWithProviders(
            <PasswordField
                label="Password"
                id="password"
                name="password"
                autoComplete="new-password"
                passwordrules="minlength: 12;"
            />,
        );

        const input = screen.getByLabelText('Password');

        expect(input.getAttribute('type')).toBe('password');
        expect(input.id).toBe('password');
        expect(input.getAttribute('name')).toBe('password');
        expect(input.getAttribute('autocomplete')).toBe('new-password');
        expect(input.getAttribute('passwordrules')).toBe('minlength: 12;');
    });

    it('shows the password, then hides it again', () => {
        renderWithProviders(<PasswordField label="Password" id="password" />);

        const input = screen.getByLabelText('Password');
        const toggle = screen.getByRole('button', { name: 'Show password' });

        expect(toggle.getAttribute('type')).toBe('button');
        expect(toggle.getAttribute('aria-controls')).toBe('password');

        fireEvent.click(toggle);

        expect(input.getAttribute('type')).toBe('text');

        fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));

        expect(input.getAttribute('type')).toBe('password');
        expect(
            screen.getByRole('button', { name: 'Show password' }),
        ).toBeTruthy();
    });

    it('shows the error under the field', () => {
        renderWithProviders(
            <PasswordField
                label="Password"
                error="These credentials do not match our records."
            />,
        );

        const input = screen.getByLabelText('Password');
        const error = screen.getByText(
            'These credentials do not match our records.',
        );

        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBe(error.id);
    });

    it('disables the toggle with the field', () => {
        renderWithProviders(<PasswordField label="Password" disabled />);

        expect(
            screen
                .getByRole('button', { name: 'Show password' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it('shows a mark in the field, before the show / hide button', () => {
        renderWithProviders(
            <PasswordField
                label="Confirm new password"
                mark={<span role="img" aria-label="Passwords match" />}
            />,
        );

        const mark = screen.getByRole('img', { name: 'Passwords match' });
        const toggle = screen.getByRole('button', { name: 'Show password' });

        expect(
            mark.compareDocumentPosition(toggle) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});
