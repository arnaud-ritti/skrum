import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFormState } from '@/test/inertia-form';
import { renderWithProviders } from '@/test/render';
import type { TwoFactorSummary } from '@/types/auth';
import { TwoFactorCard } from './two-factor-card';

type VisitOptions = {
    onSuccess?: () => void;
    onError?: () => void;
    onFinish?: () => void;
};

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, unknown>,
    props: {} as Record<string, unknown>,
}));
const router = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));
const twoFactor = vi.hoisted(() => ({
    qrCodeSvg: null as string | null,
    manualSetupKey: null as string | null,
    recoveryCodesList: [] as string[],
    errors: [] as string[],
    fetchSetupData: vi.fn(),
    fetchRecoveryCodes: vi.fn(),
    clearSetupData: vi.fn(),
    clearTwoFactorAuthData: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        Form: formMock(form as never),
        router,
    };
});

vi.mock('@/hooks/use-two-factor-auth', () => ({
    OTP_MAX_LENGTH: 6,
    useTwoFactorAuth: () => ({
        ...twoFactor,
        hasSetupData:
            twoFactor.qrCodeSvg !== null && twoFactor.manualSetupKey !== null,
    }),
}));

const off: TwoFactorSummary = {
    confirmedAt: null,
    recoveryCodesRemaining: null,
    recoveryCodesTotal: 8,
};

const on: TwoFactorSummary = {
    confirmedAt: '2026-03-12T09:14:00+00:00',
    recoveryCodesRemaining: 7,
    recoveryCodesTotal: 8,
};

const codes = Array.from({ length: 8 }, (_, index) => `code-${index + 1}`);

beforeEach(() => {
    page.props = { translations: {}, locale: 'en-GB' };
    Object.assign(form, createFormState());
    router.post.mockReset();
    router.delete.mockReset();
    twoFactor.qrCodeSvg = null;
    twoFactor.manualSetupKey = null;
    twoFactor.recoveryCodesList = [];
    twoFactor.errors = [];
    twoFactor.fetchSetupData.mockReset();
    twoFactor.fetchRecoveryCodes.mockReset();
    twoFactor.clearSetupData.mockReset();
    twoFactor.clearTwoFactorAuthData.mockReset();
});

function card(): HTMLElement {
    return screen.getByRole('region', { name: 'Two-factor authentication' });
}

async function startSetup(): Promise<void> {
    router.post.mockImplementation(
        (_url: string, _data: unknown, options: VisitOptions) => {
            twoFactor.qrCodeSvg = '<svg></svg>';
            twoFactor.manualSetupKey = 'JBSWY3DPEHPK3PXP';
            options.onSuccess?.();
            options.onFinish?.();
        },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Enable 2FA' }));
}

describe('TwoFactorCard, off', () => {
    it('says the second factor is off and offers to enable it', () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
            />,
        );

        expect(card().querySelector('[data-slot="badge"]')?.textContent).toBe(
            'Off',
        );
        expect(screen.getByRole('button', { name: 'Enable 2FA' })).toBeTruthy();
        expect(
            document.querySelector('[data-slot="two-factor-setup"]'),
        ).toBeNull();
    });

    it('enables it on the server, then shows the setup inside the card, not in a dialog', async () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
            />,
        );

        await startSetup();

        expect(router.post.mock.calls[0][0]).toBe(
            '/user/two-factor-authentication',
        );
        expect(twoFactor.fetchSetupData).toHaveBeenCalledTimes(1);
        expect(
            card().querySelector('[data-slot="two-factor-setup"]'),
        ).not.toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(card().closest('form')?.getAttribute('action')).toBe(
            '/user/confirmed-two-factor-authentication',
        );
    });

    it('enables the confirmation only once the six digits are typed', async () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
            />,
        );

        await startSetup();

        const submit = screen.getByRole('button', { name: 'Enable 2FA' });

        expect(submit.getAttribute('type')).toBe('submit');
        expect(submit.hasAttribute('disabled')).toBe(true);

        fireEvent.change(screen.getByLabelText('Enter the 6-digit code'), {
            target: { value: '123456' },
        });

        expect(submit.hasAttribute('disabled')).toBe(false);
    });

    it('shows a refused code and empties the boxes', async () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
            />,
        );

        await startSetup();

        fireEvent.change(screen.getByLabelText('Enter the 6-digit code'), {
            target: { value: '123456' },
        });
        form.errors = {
            confirmTwoFactorAuthentication: { code: 'The code was invalid.' },
        };
        act(() => (form.props.onError as () => void)());

        expect(screen.getByRole('alert').textContent).toBe(
            'The code was invalid.',
        );
        expect(
            (
                screen.getByLabelText(
                    'Enter the 6-digit code',
                ) as HTMLInputElement
            ).value,
        ).toBe('');
    });

    it('"Cancel" closes the setup and the card offers to continue it', async () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
            />,
        );

        await startSetup();
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(
            document.querySelector('[data-slot="two-factor-setup"]'),
        ).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'Continue setup' }),
        );

        expect(router.post).toHaveBeenCalledTimes(1);
        expect(
            document.querySelector('[data-slot="two-factor-setup"]'),
        ).not.toBeNull();
    });

    it('shows the recovery codes after the code is accepted, and "Finish" waits for the checkbox', async () => {
        const view = renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
            />,
        );

        await startSetup();

        twoFactor.recoveryCodesList = codes;
        await act(async () => (form.props.onSuccess as () => void)());
        view.rerender(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        expect(twoFactor.fetchRecoveryCodes).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Save your recovery codes')).toBeTruthy();
        expect(
            within(
                screen.getByRole('list', { name: 'Recovery codes' }),
            ).getAllByRole('listitem').length,
        ).toBe(8);
        expect(screen.queryByRole('button', { name: 'Print' })).toBeNull();

        const finish = screen.getByRole('button', { name: 'Finish' });

        expect(finish.hasAttribute('disabled')).toBe(true);

        await userEvent.click(
            screen.getByRole('checkbox', {
                name: 'I have saved my recovery codes',
            }),
        );

        expect(finish.hasAttribute('disabled')).toBe(false);

        await userEvent.click(finish);

        expect(twoFactor.clearSetupData).toHaveBeenCalledTimes(1);
        expect(card().querySelector('[data-slot="badge"]')?.textContent).toBe(
            'On',
        );
        expect(screen.getByText('Added on 12 March 2026')).toBeTruthy();
    });

    it('goes from the QR code to the recovery codes without a code when the server asks for none', async () => {
        const view = renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation={false}
                summary={off}
            />,
        );

        await startSetup();
        view.rerender(
            <TwoFactorCard
                enabled
                requiresConfirmation={false}
                summary={{ ...off, recoveryCodesRemaining: 8 }}
            />,
        );

        expect(screen.queryByLabelText('Enter the 6-digit code')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.getByText('Save your recovery codes')).toBeTruthy();
    });

    it('says what failed when the QR code cannot be fetched', async () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
            />,
        );

        twoFactor.errors = ['Failed to fetch QR code'];
        await startSetup();

        expect(screen.getByRole('alert').textContent).toContain(
            'Failed to fetch QR code',
        );
    });

    it('offers to fetch the setup again, and no way forward, when it cannot be fetched and no code is asked', async () => {
        router.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                twoFactor.errors = ['Failed to fetch QR code'];
                options.onSuccess?.();
                options.onFinish?.();
            },
        );
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation={false}
                summary={off}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Enable 2FA' }),
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Continue',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(twoFactor.fetchSetupData).toHaveBeenCalledTimes(1);

        await userEvent.click(
            within(screen.getByRole('alert')).getByRole('button', {
                name: 'Retry',
            }),
        );

        expect(twoFactor.fetchSetupData).toHaveBeenCalledTimes(2);

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.getByRole('button', { name: 'Enable 2FA' })).toBeTruthy();
    });

    it('keeps the checkbox and "Finish" off, and offers to retry, while there is no recovery code', async () => {
        const view = renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation={false}
                summary={off}
            />,
        );

        await startSetup();
        view.rerender(
            <TwoFactorCard
                enabled
                requiresConfirmation={false}
                summary={{ ...off, recoveryCodesRemaining: 8 }}
            />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const alert = await screen.findByRole('alert');

        expect(alert.textContent).toContain('Failed to fetch recovery codes');
        expect(
            screen.queryByRole('status', { name: 'Loading recovery codes' }),
        ).toBeNull();
        expect(
            (
                screen.getByLabelText(
                    'I have saved my recovery codes',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Finish',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(twoFactor.fetchRecoveryCodes).toHaveBeenCalledTimes(1);

        await userEvent.click(
            within(alert).getByRole('button', { name: 'Retry' }),
        );

        expect(twoFactor.fetchRecoveryCodes).toHaveBeenCalledTimes(2);
    });
});

describe('TwoFactorCard, on', () => {
    it('shows the date it was added and the recovery codes left', () => {
        renderWithProviders(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        expect(card().querySelector('[data-slot="badge"]')?.textContent).toBe(
            'On',
        );
        expect(screen.getByText('Added on 12 March 2026')).toBeTruthy();
        expect(screen.getByText('7 of 8 recovery codes left')).toBeTruthy();
        expect(screen.queryByText(/last used/i)).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Change device' }),
        ).toBeNull();
    });

    it('fetches and shows the recovery codes on demand, then hides them', async () => {
        let answer = (): void => undefined;

        twoFactor.fetchRecoveryCodes.mockReturnValue(
            new Promise<void>((resolve) => {
                answer = resolve;
            }),
        );

        const view = renderWithProviders(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        expect(twoFactor.fetchRecoveryCodes).not.toHaveBeenCalled();

        const toggle = screen.getByRole('button', {
            name: 'View recovery codes',
        });

        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        await userEvent.click(toggle);

        expect(twoFactor.fetchRecoveryCodes).toHaveBeenCalledTimes(1);
        expect(
            screen.getByRole('status', { name: 'Loading recovery codes' }),
        ).toBeTruthy();

        twoFactor.recoveryCodesList = codes.slice(0, 7);
        await act(async () => answer());
        view.rerender(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        expect(
            within(
                screen.getByRole('list', { name: 'Recovery codes' }),
            ).getAllByRole('listitem').length,
        ).toBe(7);

        await userEvent.click(
            screen.getByRole('button', { name: 'Hide recovery codes' }),
        );

        expect(
            screen.queryByRole('list', { name: 'Recovery codes' }),
        ).toBeNull();
    });

    it('offers to regenerate the codes on their row, beside "View recovery codes", and shows the new ones', async () => {
        twoFactor.recoveryCodesList = codes;
        renderWithProviders(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        const regenerate = screen.getByRole('button', {
            name: 'Regenerate codes',
        });
        const row = regenerate.closest('[data-slot="two-factor-row"]');

        expect(row).not.toBeNull();
        expect(
            within(row as HTMLElement).getByRole('button', {
                name: 'View recovery codes',
            }),
        ).toBeTruthy();
        expect(regenerate.getAttribute('type')).toBe('submit');
        expect(regenerate.closest('form')?.getAttribute('action')).toBe(
            '/user/two-factor-recovery-codes',
        );
        expect(
            screen.queryByRole('list', { name: 'Recovery codes' }),
        ).toBeNull();

        await act(async () => (form.props.onSuccess as () => void)());

        expect(twoFactor.fetchRecoveryCodes).toHaveBeenCalledTimes(1);
        expect(
            within(
                screen.getByRole('list', { name: 'Recovery codes' }),
            ).getAllByRole('listitem').length,
        ).toBe(8);
        expect(
            screen.getByText(
                'Each recovery code can be used once. Regenerating them makes the old codes invalid.',
            ),
        ).toBeTruthy();
        expect(
            screen.getAllByRole('button', { name: 'Regenerate codes' }).length,
        ).toBe(1);
    });

    it('announces the new codes after a regeneration, until they are hidden', async () => {
        twoFactor.recoveryCodesList = codes;
        renderWithProviders(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        const announcement = (): string | null | undefined =>
            document.querySelector('[data-slot="recovery-codes-status"]')
                ?.textContent;

        expect(announcement()).toBe('');

        await act(async () => (form.props.onSuccess as () => void)());

        expect(announcement()).toBe('New recovery codes generated.');

        const hide = screen.getByRole('button', {
            name: 'Hide recovery codes',
        });

        expect(hide.getAttribute('aria-controls')).not.toBeNull();

        await userEvent.click(hide);

        expect(announcement()).toBe('');
        expect(
            screen
                .getByRole('button', { name: 'View recovery codes' })
                .hasAttribute('aria-controls'),
        ).toBe(false);
    });

    it('says nothing about the count while more than three codes are left', () => {
        renderWithProviders(
            <TwoFactorCard
                enabled
                requiresConfirmation
                summary={{ ...on, recoveryCodesRemaining: 4 }}
            />,
        );

        expect(
            document.querySelector('[data-slot="recovery-codes-alert"]'),
        ).toBeNull();
    });

    it('warns with the count at three codes or fewer', () => {
        const view = renderWithProviders(
            <TwoFactorCard
                enabled
                requiresConfirmation
                summary={{ ...on, recoveryCodesRemaining: 3 }}
            />,
        );

        const lowCodesAlert = (): HTMLElement =>
            document.querySelector(
                '[data-slot="recovery-codes-alert"]',
            ) as HTMLElement;
        const alert = lowCodesAlert();

        expect(alert.getAttribute('role')).toBe('status');
        expect(alert.textContent).toContain('Only 3 recovery codes left');
        expect(alert.textContent).toContain(
            'Regenerate your codes to get 8 new ones. The old ones stop working.',
        );
        expect(alert.closest('[data-slot="two-factor-row"]')).toBe(
            screen
                .getByRole('button', { name: 'Regenerate codes' })
                .closest('[data-slot="two-factor-row"]'),
        );
        expect(screen.queryByRole('alert')).toBeNull();

        view.rerender(
            <TwoFactorCard
                enabled
                requiresConfirmation
                summary={{ ...on, recoveryCodesRemaining: 1 }}
            />,
        );

        expect(lowCodesAlert().textContent).toContain(
            'Only one recovery code left',
        );
    });

    it('turns the alert to the error tone when no code is left', () => {
        renderWithProviders(
            <TwoFactorCard
                enabled
                requiresConfirmation
                summary={{ ...on, recoveryCodesRemaining: 0 }}
            />,
        );

        const alert = screen.getByRole('alert');

        expect(alert.textContent).toContain('No recovery codes left');
        expect(alert.textContent).toContain(
            'If you lose your phone, you may not be able to sign in. Regenerate your codes now.',
        );
        expect(alert.className).toContain('bg-skrum-destructive-soft');
        expect(screen.getByText('0 of 8 recovery codes left')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Regenerate codes' }),
        ).toBeTruthy();
    });

    it('offers no codes to view, and reports no failed fetch, when no code is left', async () => {
        renderWithProviders(
            <TwoFactorCard
                enabled
                requiresConfirmation
                summary={{ ...on, recoveryCodesRemaining: 0 }}
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'View recovery codes' }),
        ).toBeNull();

        await act(async () => (form.props.onSuccess as () => void)());

        expect(screen.getAllByRole('alert').length).toBe(1);
        expect(screen.queryByText('Failed to fetch recovery codes')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });

    it('shows no alert when the count of codes is unknown', () => {
        renderWithProviders(
            <TwoFactorCard
                enabled
                requiresConfirmation
                summary={{ ...on, recoveryCodesRemaining: null }}
            />,
        );

        expect(
            document.querySelector('[data-slot="recovery-codes-alert"]'),
        ).toBeNull();
    });

    it('turns it off after a confirmation, without asking for a code', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) => options.onSuccess?.(),
        );
        renderWithProviders(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        const trigger = screen.getByRole('button', { name: 'Turn off 2FA' });

        expect(trigger.querySelector('svg')).not.toBeNull();

        await userEvent.click(trigger);

        const dialog = screen.getByRole('alertdialog', {
            name: 'Turn off two-factor authentication?',
        });

        expect(within(dialog).queryByRole('textbox')).toBeNull();
        expect(router.delete).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Turn off 2FA' }),
        );

        expect(router.delete.mock.calls[0][0]).toBe(
            '/user/two-factor-authentication',
        );
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('gives the dialog back, with a message, when turning off ends without an answer', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) => options.onFinish?.(),
        );
        renderWithProviders(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Turn off 2FA' }),
        );

        const dialog = within(screen.getByRole('alertdialog'));

        await userEvent.click(
            dialog.getByRole('button', { name: 'Turn off 2FA' }),
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

    it('forgets the codes it held once the second factor is off', () => {
        const view = renderWithProviders(
            <TwoFactorCard enabled requiresConfirmation summary={on} />,
        );

        view.rerender(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
            />,
        );

        expect(twoFactor.clearTwoFactorAuthData).toHaveBeenCalledTimes(1);
    });
});

describe('TwoFactorCard, with the e-mail code', () => {
    const emailOff = {
        available: true,
        enabled: false,
        address: 'ada@example.test',
        resendIn: 0,
    };

    it('lists the two methods in one card, "Off" while neither is on', () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
                emailCode={emailOff}
            />,
        );

        expect(card().querySelector('[data-slot="badge"]')?.textContent).toBe(
            'Off',
        );
        expect(
            Array.from(
                card().querySelectorAll('[data-slot="two-factor-row"]'),
            ).map((row) => row.querySelector('span')?.textContent),
        ).toEqual(['Authenticator app', 'E-mail code']);
        expect(screen.getByRole('button', { name: 'Enable 2FA' })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Send me a code' }),
        ).toBeTruthy();
    });

    it('says "On" when the e-mail code alone is on, without recovery codes', () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
                emailCode={{ ...emailOff, enabled: true }}
            />,
        );

        expect(card().querySelector('[data-slot="badge"]')?.textContent).toBe(
            'On',
        );
        expect(screen.queryByText('Recovery codes')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Turn off the e-mail code' }),
        ).toBeTruthy();
    });

    it('turns each method off on its own row', async () => {
        renderWithProviders(
            <TwoFactorCard
                enabled
                requiresConfirmation
                summary={on}
                emailCode={{ ...emailOff, enabled: true }}
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Turn off 2FA' }),
        ).toBeNull();
        expect(screen.getByText('Recovery codes')).toBeTruthy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Turn off the app' }),
        );

        const dialog = screen.getByRole('alertdialog', {
            name: 'Turn off the authenticator app?',
        });

        expect(dialog.textContent).toContain(
            'The e-mail code keeps protecting your account.',
        );
    });

    it('lists the e-mail code alone when the server offers no authenticator app', () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
                appAvailable={false}
                emailCode={emailOff}
            />,
        );

        expect(screen.queryByText('Authenticator app')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Send me a code' }),
        ).toBeTruthy();
    });

    it('keeps the card of the authenticator app alone when mail does not deliver and the e-mail code is off', () => {
        renderWithProviders(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={off}
                emailCode={{ ...emailOff, available: false }}
            />,
        );

        expect(screen.queryByText('E-mail code')).toBeNull();
        expect(screen.getByRole('button', { name: 'Enable 2FA' })).toBeTruthy();
    });
});
