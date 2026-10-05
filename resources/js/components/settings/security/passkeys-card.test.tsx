import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Passkey } from '@/types/auth';
import { defaultPasskeyName, PasskeysCard } from './passkeys-card';

type VisitOptions = {
    onSuccess?: () => void;
    onError?: () => void;
    onFinish?: () => void;
};

const router = vi.hoisted(() => ({ delete: vi.fn(), reload: vi.fn() }));
const passkey = vi.hoisted(() => ({
    isSupported: true,
    error: null as string | null,
    succeeds: true,
    register: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router,
}));

vi.mock('@laravel/passkeys/react', () => ({
    usePasskeyRegister: ({ onSuccess }: { onSuccess?: () => void }) => ({
        register: async (name: string) => {
            passkey.register(name);

            if (passkey.succeeds) {
                onSuccess?.();
            }
        },
        isLoading: false,
        error: passkey.error,
        errorInstance: null,
        isSupported: passkey.isSupported,
    }),
}));

const laptop: Passkey = {
    id: '0199a000-0000-7000-8000-0000000000aa',
    name: 'Chrome on Mac',
    authenticator: 'iCloud Keychain',
    created_at_diff: '2 days ago',
    last_used_at_diff: '1 hour ago',
};

const phone: Passkey = {
    id: '0199a000-0000-7000-8000-0000000000bb',
    name: 'Phone',
    authenticator: null,
    created_at_diff: '1 week ago',
    last_used_at_diff: null,
};

beforeEach(() => {
    router.delete.mockReset();
    router.reload.mockReset();
    passkey.register.mockReset();
    passkey.isSupported = true;
    passkey.error = null;
    passkey.succeeds = true;
});

describe('defaultPasskeyName', () => {
    const t = (
        key: string,
        replacements: Record<string, string | number> = {},
    ): string =>
        Object.entries(replacements).reduce(
            (line, [name, value]) => line.replace(`:${name}`, String(value)),
            key === ':browser on :system' ? ':browser sur :system' : key,
        );

    it('names the browser and the system in the language of the page', () => {
        expect(
            defaultPasskeyName(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                t,
            ),
        ).toBe('Chrome sur Mac');
        expect(defaultPasskeyName('curl/8', t)).toBe('');
    });
});

describe('PasskeysCard', () => {
    it('lists each passkey with its authenticator and its dates', () => {
        renderWithProviders(<PasskeysCard passkeys={[laptop, phone]} />);

        const rows = within(
            screen.getByRole('list', { name: 'Passkeys' }),
        ).getAllByRole('listitem');

        expect(rows.map((row) => row.textContent)).toEqual([
            'Chrome on MaciCloud KeychainAdded 2 days ago · Last used 1 hour agoRemove',
            'PhoneAdded 1 week agoRemove',
        ]);
    });

    it('says there is none yet', () => {
        renderWithProviders(<PasskeysCard passkeys={[]} />);

        expect(screen.getByText('No passkeys yet')).toBeTruthy();
        expect(
            screen.getByText('Add a passkey to sign in without a password'),
        ).toBeTruthy();
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('registers a passkey under the offered name, then reloads the list', async () => {
        renderWithProviders(<PasskeysCard passkeys={[]} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Add passkey' }),
        );

        const dialog = screen.getByRole('dialog', { name: 'Add passkey' });
        const name = within(dialog).getByLabelText(
            'Passkey name',
        ) as HTMLInputElement;

        expect(name.id).toBe('passkey-name');

        await userEvent.clear(name);
        await userEvent.type(name, 'Work laptop');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Register passkey' }),
        );

        expect(passkey.register).toHaveBeenCalledWith('Work laptop');
        await waitFor(() => expect(router.reload).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('keeps the dialog open with the reason when the browser refuses', async () => {
        passkey.succeeds = false;
        passkey.error = 'The operation was cancelled.';
        renderWithProviders(<PasskeysCard passkeys={[]} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Add passkey' }),
        );
        await userEvent.type(screen.getByLabelText('Passkey name'), 'Key');
        await userEvent.click(
            screen.getByRole('button', { name: 'Register passkey' }),
        );

        await waitFor(() =>
            expect(screen.getByRole('alert').textContent).toBe(
                'The operation was cancelled.',
            ),
        );
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(router.reload).not.toHaveBeenCalled();
    });

    it('does not register a passkey without a name', async () => {
        renderWithProviders(<PasskeysCard passkeys={[]} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Add passkey' }),
        );
        await userEvent.clear(screen.getByLabelText('Passkey name'));
        await userEvent.click(
            screen.getByRole('button', { name: 'Register passkey' }),
        );

        expect(passkey.register).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(document.getElementById('passkey-name-error')?.textContent).toBe(
            'A passkey needs a name.',
        );
    });

    it('does not show the refusal of an earlier attempt when the dialog opens again', async () => {
        passkey.succeeds = false;
        passkey.error = 'The operation was cancelled.';
        renderWithProviders(<PasskeysCard passkeys={[]} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Add passkey' }),
        );
        await userEvent.type(screen.getByLabelText('Passkey name'), 'Key');
        await userEvent.click(
            screen.getByRole('button', { name: 'Register passkey' }),
        );
        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        await userEvent.click(
            screen.getByRole('button', { name: 'Add passkey' }),
        );

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('says so, and offers no button, in a browser without passkeys', () => {
        passkey.isSupported = false;
        renderWithProviders(<PasskeysCard passkeys={[]} />);

        expect(
            screen.getByText('Passkeys are not supported in this browser.'),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Add passkey' }),
        ).toBeNull();
    });

    it('removes a passkey after a confirmation that names it', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) => options.onSuccess?.(),
        );
        renderWithProviders(<PasskeysCard passkeys={[laptop, phone]} />);

        const remove = screen.getByRole('button', {
            name: 'Remove Chrome on Mac',
        });

        expect(remove.querySelector('svg')).not.toBeNull();
        expect(remove.textContent).toBe('Remove');

        await userEvent.click(remove);

        const dialog = screen.getByRole('alertdialog', {
            name: 'Remove passkey',
        });

        expect(dialog.textContent).toContain(
            'Are you sure you want to remove the "Chrome on Mac" passkey? You will no longer be able to use it to sign in.',
        );
        expect(router.delete).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Remove passkey' }),
        );

        expect(router.delete.mock.calls[0][0]).toBe(
            `/user/passkeys/${laptop.id}`,
        );
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('gives the dialog back, with a message, when the removal ends without an answer', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) => options.onFinish?.(),
        );
        renderWithProviders(<PasskeysCard passkeys={[laptop]} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Remove Chrome on Mac' }),
        );

        const dialog = within(screen.getByRole('alertdialog'));

        await userEvent.click(
            dialog.getByRole('button', { name: 'Remove passkey' }),
        );

        await waitFor(() =>
            expect(dialog.getByRole('alert').textContent).toBe(
                'Something went wrong. Please try again.',
            ),
        );
        expect(
            (
                dialog.getByRole('button', {
                    name: 'Cancel',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });
});
