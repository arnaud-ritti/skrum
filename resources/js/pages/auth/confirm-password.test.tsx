import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import ConfirmPassword from './confirm-password';

const navigation = vi.hoisted(() => ({ post: vi.fn(), visit: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Head: () => null,
    router: navigation,
}));
vi.mock('@/components/auth/passkey-sign-in', () => ({
    PasskeySignIn: () => null,
}));
vi.mock('@/components/auth/email-code-confirmation', () => ({
    EmailCodeConfirmation: ({ error }: { error?: string }) => (
        <>
            <label>
                Code
                <input name="code" />
            </label>
            {error && <p role="alert">{error}</p>}
        </>
    ),
}));

beforeEach(() => vi.clearAllMocks());

describe('password confirmation dialog', () => {
    it('submits a password and lets the server redirect without invoking cancellation', async () => {
        navigation.post.mockImplementation((_url, _data, options) => {
            options.onSuccess();
            options.onFinish();
        });
        renderWithProviders(<ConfirmPassword confirmsWith="password" />);
        expect(
            screen.getByRole('dialog', { name: 'Confirm your password' }),
        ).toBeTruthy();
        await userEvent.type(screen.getByLabelText('Password'), 'secret');
        await userEvent.click(
            screen.getByRole('button', { name: 'Confirm password' }),
        );
        expect(navigation.post).toHaveBeenCalledWith(
            '/user/confirm-password',
            { password: 'secret' },
            expect.any(Object),
        );
        expect(navigation.visit).not.toHaveBeenCalled();
    });

    it('keeps the dialog open and displays a rejected password', async () => {
        navigation.post.mockImplementation((_url, _data, options) => {
            options.onError({ password: 'Incorrect password' });
            options.onFinish();
        });
        renderWithProviders(<ConfirmPassword confirmsWith="password" />);
        await userEvent.type(screen.getByLabelText('Password'), 'wrong');
        await userEvent.click(
            screen.getByRole('button', { name: 'Confirm password' }),
        );
        await waitFor(() =>
            expect(screen.getByText('Incorrect password')).toBeTruthy(),
        );
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(navigation.visit).not.toHaveBeenCalled();
    });

    it('submits email codes through the same dialog', async () => {
        navigation.post.mockImplementation((_url, _data, options) => {
            options.onSuccess();
            options.onFinish();
        });
        renderWithProviders(<ConfirmPassword confirmsWith="code" />);
        expect(
            screen.getByRole('dialog', { name: 'Confirm it is you' }),
        ).toBeTruthy();
        await userEvent.type(screen.getByLabelText('Code'), '123456');
        await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        expect(navigation.post.mock.calls[0][1]).toEqual({ code: '123456' });
        expect(navigation.visit).not.toHaveBeenCalled();
    });

    it('allows retrying when confirmation finishes without a response', async () => {
        navigation.post.mockImplementation((_url, _data, options) => {
            options.onFinish();
        });
        renderWithProviders(<ConfirmPassword confirmsWith="password" />);
        await userEvent.type(screen.getByLabelText('Password'), 'secret');
        await userEvent.click(
            screen.getByRole('button', { name: 'Confirm password' }),
        );
        await waitFor(() =>
            expect(screen.getByRole('alert').textContent).toBe(
                'Something went wrong. Please try again.',
            ),
        );
        expect(
            (
                screen.getByRole('button', {
                    name: 'Confirm password',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
        expect(navigation.visit).not.toHaveBeenCalled();
    });

    it('leaves the protected destination when cancelled', async () => {
        renderWithProviders(<ConfirmPassword confirmsWith="password" />);
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(navigation.visit).toHaveBeenCalled();
        expect(navigation.post).not.toHaveBeenCalled();
    });
});
