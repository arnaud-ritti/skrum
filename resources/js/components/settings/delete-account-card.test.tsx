import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DeleteAccountCard } from './delete-account-card';

type VisitOptions = {
    data?: Record<string, unknown>;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const router = vi.hoisted(() => ({ delete: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router,
}));

beforeEach(() => {
    router.delete.mockReset();
});

async function openDialog(): Promise<HTMLElement> {
    await userEvent.click(
        screen.getByRole('button', { name: 'Delete account' }),
    );

    return screen.getByRole('dialog');
}

describe('DeleteAccountCard', () => {
    it('states what deleting does, beside a destructive button with an icon and a label', () => {
        renderWithProviders(<DeleteAccountCard needsPassword />);

        const region = screen.getByRole('region', { name: 'Delete account' });
        const trigger = within(region).getByRole('button', {
            name: 'Delete account',
        });

        expect(region.textContent).toContain(
            'Permanently removes your profile and tokens. Cards you wrote stay, shown as "Former member".',
        );
        expect(trigger.getAttribute('data-test')).toBe('delete-user-button');
        expect(trigger.querySelector('svg')).not.toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('asks for the password in a dialog, with the hooks of the old one', async () => {
        renderWithProviders(<DeleteAccountCard needsPassword />);

        const dialog = await openDialog();
        const password = within(dialog).getByLabelText('Password');

        expect(
            within(dialog).getByRole('heading', {
                name: 'Are you sure you want to delete your account?',
            }),
        ).toBeTruthy();
        expect(password.id).toBe('delete-account-password');
        expect(password.getAttribute('name')).toBe('password');
        expect(password.getAttribute('type')).toBe('password');
        expect(password.getAttribute('autocomplete')).toBe('current-password');
        expect(
            within(dialog)
                .getByRole('button', { name: 'Delete account' })
                .getAttribute('data-test'),
        ).toBe('confirm-delete-user-button');
    });

    it('sends the password to the account deletion route', async () => {
        renderWithProviders(<DeleteAccountCard needsPassword />);

        const dialog = await openDialog();

        await userEvent.type(
            within(dialog).getByLabelText('Password'),
            'secret',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );

        expect(router.delete).toHaveBeenCalledTimes(1);

        const [url, options] = router.delete.mock.calls[0] as [
            string,
            VisitOptions,
        ];

        expect(url).toBe('/settings/profile');
        expect(options.data).toEqual({ password: 'secret' });
    });

    it('keeps the dialog open, shows the refusal under the field and focuses it, beside the password card of the same page', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) =>
                options.onError?.({
                    password: 'The password is incorrect.',
                }),
        );
        renderWithProviders(
            <>
                <input id="password" aria-label="New password" />
                <DeleteAccountCard needsPassword />
            </>,
        );

        const dialog = await openDialog();

        await userEvent.type(within(dialog).getByLabelText('Password'), 'no');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );

        await waitFor(() =>
            expect(
                document.getElementById('delete-account-password-error')
                    ?.textContent,
            ).toBe('The password is incorrect.'),
        );
        expect(screen.getByRole('dialog')).toBeTruthy();
        await waitFor(() =>
            expect(document.activeElement).toBe(
                within(screen.getByRole('dialog')).getByLabelText('Password'),
            ),
        );
    });

    it('forgets the refusal when the dialog is cancelled and opened again', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) =>
                options.onError?.({
                    password: 'The password is incorrect.',
                }),
        );
        renderWithProviders(<DeleteAccountCard needsPassword />);

        const dialog = await openDialog();

        await userEvent.type(within(dialog).getByLabelText('Password'), 'no');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );
        await waitFor(() =>
            expect(
                document.getElementById('delete-account-password-error'),
            ).not.toBeNull(),
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        await openDialog();

        expect(
            document.getElementById('delete-account-password-error'),
        ).toBeNull();
    });

    it('gives the dialog back, with a message under the field, when the visit ends without an answer', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) => options.onFinish?.(),
        );
        renderWithProviders(<DeleteAccountCard needsPassword />);

        const dialog = await openDialog();

        await userEvent.type(
            within(dialog).getByLabelText('Password'),
            'secret',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );

        await waitFor(() =>
            expect(
                document.getElementById('delete-account-password-error')
                    ?.textContent,
            ).toBe('Something went wrong. Please try again.'),
        );
        expect(
            (
                within(dialog).getByRole('button', {
                    name: 'Cancel',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('asks no password of an account without one it knows, and sends none (rule S-1)', async () => {
        renderWithProviders(<DeleteAccountCard needsPassword={false} />);

        const dialog = await openDialog();

        expect(within(dialog).queryByLabelText('Password')).toBeNull();
        expect(dialog.textContent).toContain(
            'Your profile and tokens are deleted for good. Cards you wrote stay, shown as "Former member".',
        );
        expect(dialog.textContent).not.toContain('Enter your password');

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );

        const [url, options] = router.delete.mock.calls[0] as [
            string,
            VisitOptions,
        ];

        expect(url).toBe('/settings/profile');
        expect(options.data).toBeUndefined();
    });

    it('shows a refusal in the dialog when no password field is there to hold it', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) =>
                options.onError?.({
                    password:
                        'Transfer ownership of your workspaces before deleting your account.',
                }),
        );
        renderWithProviders(<DeleteAccountCard needsPassword={false} />);

        const dialog = await openDialog();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );

        await waitFor(() =>
            expect(
                dialog.querySelector('[data-slot="dialog-error"]')?.textContent,
            ).toContain(
                'Transfer ownership of your workspaces before deleting your account.',
            ),
        );
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('closes once the account is deleted', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) => options.onSuccess?.(),
        );
        renderWithProviders(<DeleteAccountCard needsPassword />);

        const dialog = await openDialog();

        await userEvent.type(
            within(dialog).getByLabelText('Password'),
            'secret',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
});
