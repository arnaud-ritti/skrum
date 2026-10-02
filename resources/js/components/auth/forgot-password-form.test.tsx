import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
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

describe('ForgotPasswordForm', () => {
    it('keeps the id, the name and the submit hook of the old form', () => {
        const { container } = renderWithProviders(<ForgotPasswordForm />);

        const email = screen.getByLabelText('Work email');

        expect(email.id).toBe('email');
        expect(email.getAttribute('name')).toBe('email');
        expect(email.getAttribute('type')).toBe('email');
        expect(
            screen
                .getByRole('button', { name: 'Email password reset link' })
                .getAttribute('data-test'),
        ).toBe('email-password-reset-link-button');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/forgot-password',
        );
    });

    it('shows the status of the server as a success alert above the form', () => {
        const { container } = renderWithProviders(
            <ForgotPasswordForm status="We have emailed your password reset link." />,
        );

        const status = screen.getByRole('status');

        expect(status.textContent).toBe(
            'We have emailed your password reset link.',
        );
        expect(
            status.compareDocumentPosition(container.querySelector('form')!) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('shows no alert without a status', () => {
        renderWithProviders(<ForgotPasswordForm />);

        expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows the server error under the field', () => {
        form.errors = { email: 'Please wait before retrying.' };
        renderWithProviders(<ForgotPasswordForm />);

        expect(document.getElementById('email-error')?.textContent).toBe(
            'Please wait before retrying.',
        );
    });

    it('links back to the login page', () => {
        renderWithProviders(<ForgotPasswordForm />);

        expect(screen.getByText('Or, return to')).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'log in' }).getAttribute('href'),
        ).toBe('/login');
    });
});
