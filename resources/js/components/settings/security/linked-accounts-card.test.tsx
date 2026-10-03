import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordGateContext } from '@/components/settings/password-gate';
import { renderWithProviders } from '@/test/render';
import { LinkedAccountsCard } from './linked-accounts-card';
import type { LinkedAccountRow, LinkedAccounts } from './linked-accounts-card';

type VisitOptions = {
    preserveScroll?: boolean;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const router = vi.hoisted(() => ({ delete: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router,
}));

vi.mock('sonner', () => ({ toast }));

const google: LinkedAccountRow = {
    provider: 'google',
    label: 'Google',
    isEnabled: true,
    account: {
        id: '0199a000-0000-7000-8000-000000000001',
        linkedAt: '2025-11-18T10:00:00+00:00',
        isManaged: false,
        canUnlink: true,
    },
};

const github: LinkedAccountRow = {
    provider: 'github',
    label: 'GitHub',
    isEnabled: true,
    account: null,
};

const entraOff: LinkedAccountRow = {
    provider: 'entra',
    label: 'Microsoft',
    isEnabled: false,
    account: {
        id: '0199a000-0000-7000-8000-000000000002',
        linkedAt: '2026-02-03T10:00:00+00:00',
        isManaged: false,
        canUnlink: true,
    },
};

const managed: LinkedAccountRow = {
    provider: 'oidc',
    label: 'Nordlys SSO',
    isEnabled: true,
    account: {
        id: '0199a000-0000-7000-8000-000000000003',
        linkedAt: '2026-02-03T10:00:00+00:00',
        isManaged: true,
        canUnlink: false,
    },
};

const last: LinkedAccountRow = {
    ...google,
    account: { ...google.account!, canUnlink: false },
};

const guard = vi.fn((action: () => void) => action());
const assign = vi.fn();

function withGate(ui: ReactElement) {
    return renderWithProviders(
        <PasswordGateContext.Provider value={{ guard }}>
            {ui}
        </PasswordGateContext.Provider>,
    );
}

function accounts(rows: LinkedAccountRow[], lastWayIn = false): LinkedAccounts {
    return { rows, lastWayIn };
}

function row(provider: string): HTMLElement {
    return document.querySelector(
        `[data-linked-provider="${provider}"]`,
    ) as HTMLElement;
}

beforeEach(() => {
    router.delete.mockReset();
    router.delete.mockImplementation((_url: string, options: VisitOptions) =>
        options.onSuccess?.(),
    );
    toast.error.mockReset();
    guard.mockClear();
    assign.mockReset();
    vi.stubGlobal('location', { assign });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('LinkedAccountsCard', () => {
    it('is the card "Linked accounts" with the sentence of the mockup', () => {
        withGate(<LinkedAccountsCard accounts={accounts([google, github])} />);

        const card = screen.getByRole('region', { name: 'Linked accounts' });

        expect(card.closest('[data-slot="linked-accounts"]')).not.toBeNull();
        expect(card.textContent).toContain(
            'Sign in with your company SSO or an existing account. Keep at least one way in.',
        );
    });

    it('shows a linked row with its mark, its label, the date it was linked and "Unlink"', () => {
        withGate(<LinkedAccountsCard accounts={accounts([google, github])} />);

        expect(row('google').textContent).toContain('Google');
        expect(row('google').textContent).toContain('Linked Nov 18, 2025');
        expect(row('google').textContent).not.toContain('Not linked');
        expect(
            within(row('google')).getByRole('button', { name: 'Unlink' }),
        ).toBeTruthy();
        expect(row('github').querySelector('.lucide-github')).not.toBeNull();
    });

    it('shows a row not linked with "Not linked" and "Link :provider", and leaves for the provider through the gate', async () => {
        withGate(<LinkedAccountsCard accounts={accounts([google, github])} />);

        expect(row('github').textContent).toContain('Not linked');

        await userEvent.click(
            within(row('github')).getByRole('button', { name: 'Link GitHub' }),
        );

        expect(guard).toHaveBeenCalledOnce();
        expect(assign).toHaveBeenCalledWith('/settings/linked-accounts/github');
    });

    it('keeps a provider turned off with "Not available on this instance" and "Unlink"', () => {
        withGate(
            <LinkedAccountsCard accounts={accounts([google, entraOff])} />,
        );

        expect(row('entra').textContent).toContain(
            'Not available on this instance',
        );
        expect(
            within(row('entra')).getByRole('button', { name: 'Unlink' }),
        ).toBeTruthy();
        expect(
            within(row('entra')).queryByRole('button', {
                name: 'Link Microsoft',
            }),
        ).toBeNull();
    });

    it('marks an identity managed by the admin, with no "Unlink"', () => {
        withGate(<LinkedAccountsCard accounts={accounts([managed, google])} />);

        expect(
            within(row('oidc')).getByText('Managed by your admin'),
        ).toBeTruthy();
        expect(
            within(row('oidc')).queryByRole('button', { name: 'Unlink' }),
        ).toBeNull();
    });

    it('disables "Unlink" on the last way in, gives the reason, and shows the note', () => {
        withGate(
            <LinkedAccountsCard accounts={accounts([last, github], true)} />,
        );

        const unlink = within(row('google')).getByRole('button', {
            name: 'Unlink',
        }) as HTMLButtonElement;

        expect(unlink.disabled).toBe(true);
        expect(unlink.getAttribute('aria-describedby')).not.toBeNull();
        expect(
            document.getElementById(
                unlink.getAttribute('aria-describedby') as string,
            )?.textContent,
        ).toBe(
            "You can't unlink your last sign-in method: set a password or link another account first.",
        );
        expect(
            screen
                .getByRole('region', { name: 'Linked accounts' })
                .querySelector('[data-slot="linked-accounts-note"]')
                ?.textContent,
        ).toBe(
            "You can't unlink your last sign-in method: set a password or link another account first.",
        );
    });

    it('shows no note while another way in remains', () => {
        withGate(<LinkedAccountsCard accounts={accounts([google, github])} />);

        expect(
            document.querySelector('[data-slot="linked-accounts-note"]'),
        ).toBeNull();
        expect(
            screen
                .getByRole('region', { name: 'Linked accounts' })
                .querySelector('[data-slot="settings-card-footer"]'),
        ).toBeNull();
    });

    it('unlinks after its confirmation, through the gate', async () => {
        withGate(<LinkedAccountsCard accounts={accounts([google, github])} />);

        await userEvent.click(
            within(row('google')).getByRole('button', { name: 'Unlink' }),
        );

        expect(guard).toHaveBeenCalledOnce();
        expect(router.delete).not.toHaveBeenCalled();

        const dialog = screen.getByRole('alertdialog', {
            name: 'Unlink Google?',
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Unlink' }),
        );

        expect(router.delete.mock.calls[0][0]).toBe(
            `/settings/linked-accounts/${google.account!.id}`,
        );
        expect(router.delete.mock.calls[0][1]).toMatchObject({
            preserveScroll: true,
        });
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('shows the refusal of the server as a toast and closes the dialog', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) =>
                options.onError?.({
                    account:
                        "You can't unlink your last sign-in method: set a password or link another account first.",
                }),
        );
        withGate(<LinkedAccountsCard accounts={accounts([google, github])} />);

        await userEvent.click(
            within(row('google')).getByRole('button', { name: 'Unlink' }),
        );
        await userEvent.click(
            within(
                screen.getByRole('alertdialog', { name: 'Unlink Google?' }),
            ).getByRole('button', { name: 'Unlink' }),
        );

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "You can't unlink your last sign-in method: set a password or link another account first.",
            ),
        );
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('offers no "Confirm with" button anywhere (rule S-1)', () => {
        withGate(
            <LinkedAccountsCard
                accounts={accounts([last, github, entraOff, managed], true)}
            />,
        );

        expect(
            screen.queryByRole('button', { name: /Confirm with/ }),
        ).toBeNull();
    });

    it('is concealed before the confirmation: nothing of the account, one action through the gate', async () => {
        withGate(<LinkedAccountsCard accounts={null} />);

        const card = screen.getByRole('region', { name: 'Linked accounts' });

        expect(card.querySelector('[data-linked-provider]')).toBeNull();
        expect(card.textContent).toContain(
            'Confirm your password to see your linked accounts.',
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show my linked accounts' }),
        );

        expect(guard).toHaveBeenCalledOnce();
        expect(router.delete).not.toHaveBeenCalled();
        expect(assign).not.toHaveBeenCalled();
    });
});
