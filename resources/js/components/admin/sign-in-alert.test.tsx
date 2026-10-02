import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignInSettingsController from '@/actions/App/Http/Controllers/Admin/SignInSettingsController';
import { SignInAlert } from '@/components/admin/sign-in-alert';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

describe('SignInAlert', () => {
    beforeEach(() => {
        page.props = { translations: {}, signInAlert: null };
    });

    it('renders nothing without the alert of the server', () => {
        const { container } = render(<SignInAlert />);

        expect(container.innerHTML).toBe('');
    });

    it('tells an admin that required single sign-on is ignored, with a link to the setting', () => {
        page.props = { translations: {}, signInAlert: 'sso_required_ignored' };

        render(<SignInAlert />);

        expect(screen.getByRole('alert')?.textContent).toContain(
            'Single sign-on is required on this instance, but no provider is configured: the setting is ignored and every sign-in method works.',
        );
        expect(
            screen
                .getByRole('link', { name: 'Sign-in settings' })
                .getAttribute('href'),
        ).toBe(SignInSettingsController.edit.url());
    });
});
