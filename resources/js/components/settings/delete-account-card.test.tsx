import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DeleteAccountCard } from './delete-account-card';

type VisitOptions = {
    data?: Record<string, unknown>;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
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
        renderWithProviders(<DeleteAccountCard />);

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
        renderWithProviders(<DeleteAccountCard />);

        const dialog = await openDialog();
        const password = within(dialog).getByLabelText('Password');

        expect(
            within(dialog).getByRole('heading', {
                name: 'Are you sure you want to delete your account?',
            }),
        ).toBeTruthy();
        expect(password.id).toBe('password');
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
        renderWithProviders(<DeleteAccountCard />);

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

    it('keeps the dialog open, shows the refusal under the field and focuses it', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) =>
                options.onError?.({
                    password: 'The password is incorrect.',
                }),
        );
        renderWithProviders(<DeleteAccountCard />);

        const dialog = await openDialog();

        await userEvent.type(within(dialog).getByLabelText('Password'), 'no');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );

        await waitFor(() =>
            expect(document.getElementById('password-error')?.textContent).toBe(
                'The password is incorrect.',
            ),
        );
        expect(screen.getByRole('dialog')).toBeTruthy();
        await waitFor(() =>
            expect(document.activeElement?.id).toBe('password'),
        );
    });

    it('forgets the refusal when the dialog is cancelled and opened again', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) =>
                options.onError?.({
                    password: 'The password is incorrect.',
                }),
        );
        renderWithProviders(<DeleteAccountCard />);

        const dialog = await openDialog();

        await userEvent.type(within(dialog).getByLabelText('Password'), 'no');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete account' }),
        );
        await waitFor(() =>
            expect(document.getElementById('password-error')).not.toBeNull(),
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        await openDialog();

        expect(document.getElementById('password-error')).toBeNull();
    });

    it('closes once the account is deleted', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) => options.onSuccess?.(),
        );
        renderWithProviders(<DeleteAccountCard />);

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
