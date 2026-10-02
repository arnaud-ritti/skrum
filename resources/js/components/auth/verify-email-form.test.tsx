import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';
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

describe('VerifyEmailForm', () => {
    it('posts the resend request from a secondary button', () => {
        const { container } = renderWithProviders(<VerifyEmailForm />);

        const resend = screen.getByRole('button', {
            name: 'Resend verification email',
        });

        expect(resend.getAttribute('type')).toBe('submit');
        expect(resend.className).toContain('bg-secondary');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/email/verification-notification',
        );
        expect(container.querySelector('form')?.getAttribute('method')).toBe(
            'post',
        );
    });

    it('says the link was sent only for the status of a sent link', () => {
        const sentence =
            'A new verification link has been sent to the email address you provided during registration.';
        const { unmount } = renderWithProviders(
            <VerifyEmailForm status="verification-link-sent" />,
        );

        expect(screen.getByRole('status').textContent).toBe(sentence);

        unmount();
        renderWithProviders(<VerifyEmailForm status="something-else" />);

        expect(screen.queryByRole('status')).toBeNull();
    });

    it('logs out with a button outside the resend form', () => {
        const { container } = renderWithProviders(<VerifyEmailForm />);

        const logout = screen.getByRole('button', { name: 'Log out' });

        expect(container.querySelector('form')?.contains(logout)).toBe(false);
    });

    it('disables the resend button while the request runs', () => {
        form.processing = true;
        renderWithProviders(<VerifyEmailForm />);

        expect(
            (
                screen.getByRole('button', {
                    name: 'Resend verification email',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });
});
