import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CreateTokenForm } from './api-tokens/create-token-form';
import { activeToken } from './api-tokens/fixtures';
import { ServerUrl } from './api-tokens/server-url';
import { TokenList } from './api-tokens/token-list';
import { PasswordGateContext } from './password-gate';
import { EmailCodeRow } from './security/email-code-row';
import { PasskeysCard } from './security/passkeys-card';
import { TwoFactorCard, TwoFactorConcealed } from './security/two-factor-card';

/*
 * Before the password is confirmed the protected cards say nothing of the
 * account, and every protected action, before or after, goes through the
 * gate of the page: nothing is sent or opened until the gate lets it go.
 */

const router = vi.hoisted(() => ({
    post: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
}));
const form = vi.hoisted(() => ({ submit: vi.fn() }));
const twoFactor = vi.hoisted(() => ({
    fetchSetupData: vi.fn(),
    fetchRecoveryCodes: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { useState } = await import('react');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router,
        useForm: (initial: Record<string, unknown>) => {
            const [data, setState] = useState(initial);

            return {
                data,
                setData: (key: string, value: unknown) =>
                    setState((current) => ({ ...current, [key]: value })),
                errors: {},
                processing: false,
                submit: form.submit,
                reset: () => setState(initial),
            };
        },
    };
});

vi.mock('@laravel/passkeys/react', () => ({
    usePasskeyRegister: () => ({
        register: vi.fn(),
        isLoading: false,
        error: null,
        errorInstance: null,
        isSupported: true,
    }),
}));

vi.mock('@/hooks/use-two-factor-auth', () => ({
    OTP_MAX_LENGTH: 6,
    useTwoFactorAuth: () => ({
        qrCodeSvg: null,
        manualSetupKey: null,
        recoveryCodesList: [],
        errors: [],
        hasSetupData: false,
        clearSetupData: vi.fn(),
        clearTwoFactorAuthData: vi.fn(),
        ...twoFactor,
    }),
}));

const held: Array<() => void> = [];
const guard = vi.fn((action: () => void) => {
    held.push(action);
});

function behindTheGate(card: ReactElement) {
    return renderWithProviders(
        <PasswordGateContext.Provider value={{ guard }}>
            {card}
        </PasswordGateContext.Provider>,
    );
}

async function press(name: string | RegExp): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name }));
}

const summary = {
    confirmedAt: '2026-03-12T09:14:00+00:00',
    recoveryCodesRemaining: 7,
    recoveryCodesTotal: 8,
};

const emailCode = {
    available: true,
    enabled: false,
    address: 'ada@example.test',
    resendIn: 0,
};

const laptop = {
    id: '0199a000-0000-7000-8000-0000000000aa',
    name: 'Chrome on Mac',
    authenticator: null,
    created_at_diff: '2 days ago',
    last_used_at_diff: null,
};

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
    Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
    held.length = 0;
    guard.mockClear();
    router.post.mockReset();
    router.delete.mockReset();
    router.reload.mockReset();
    form.submit.mockReset();
    twoFactor.fetchSetupData.mockReset();
    twoFactor.fetchRecoveryCodes.mockReset();
});

describe('the two-factor card before the password is confirmed', () => {
    it('lists the methods the instance offers, with no state, no address and no count', () => {
        behindTheGate(<TwoFactorConcealed appAvailable emailCodeAvailable />);

        const card = screen.getByRole('region', {
            name: 'Two-factor authentication',
        });

        expect(within(card).getByText('Authenticator app')).toBeTruthy();
        expect(within(card).getByText('E-mail code')).toBeTruthy();
        expect(card.textContent).not.toMatch(/\bOn\b|\bOff\b/);
        expect(card.textContent).not.toContain('@');
        expect(card.textContent).not.toContain('recovery');
        expect(
            within(card)
                .getAllByRole('button')
                .map((button) => button.textContent),
        ).toEqual(['Manage two-factor authentication']);
    });

    it('lists only what the instance offers', () => {
        behindTheGate(
            <TwoFactorConcealed appAvailable emailCodeAvailable={false} />,
        );

        expect(screen.getByText('Authenticator app')).toBeTruthy();
        expect(screen.queryByText('E-mail code')).toBeNull();
    });

    it('asks for the password when the reader wants to manage the methods', async () => {
        behindTheGate(<TwoFactorConcealed appAvailable emailCodeAvailable />);

        await press('Manage two-factor authentication');

        expect(guard).toHaveBeenCalledOnce();
    });
});

describe('the two-factor card once the state is shown', () => {
    it.each([['View recovery codes'], ['Regenerate codes'], ['Turn off 2FA']])(
        'sends "%s" through the gate first',
        async (name) => {
            behindTheGate(
                <TwoFactorCard
                    enabled
                    requiresConfirmation
                    summary={summary}
                />,
            );

            await press(name);

            expect(guard).toHaveBeenCalledOnce();
            expect(twoFactor.fetchRecoveryCodes).not.toHaveBeenCalled();
            expect(screen.queryByRole('alertdialog')).toBeNull();
            expect(router.post).not.toHaveBeenCalled();
            expect(router.delete).not.toHaveBeenCalled();
        },
    );

    it('turns the app on only once the gate lets it', async () => {
        behindTheGate(
            <TwoFactorCard
                enabled={false}
                requiresConfirmation
                summary={{ ...summary, confirmedAt: null }}
            />,
        );

        await press('Enable 2FA');

        expect(router.post).not.toHaveBeenCalled();

        held[0]();

        expect(router.post).toHaveBeenCalledOnce();
        expect(router.post.mock.calls[0][0]).toBe(
            '/user/two-factor-authentication',
        );
    });

    it('hides shown recovery codes without asking anything', async () => {
        guard.mockImplementationOnce((action) => action());
        behindTheGate(
            <TwoFactorCard enabled requiresConfirmation summary={summary} />,
        );

        await press('View recovery codes');
        await press('Hide recovery codes');

        expect(guard).toHaveBeenCalledOnce();
    });

    it.each([
        ['Send me a code', { ...emailCode }],
        ['Turn off the e-mail code', { ...emailCode, enabled: true }],
    ])('sends "%s" through the gate first', async (name, state) => {
        behindTheGate(<EmailCodeRow {...state} appEnabled={false} />);

        await press(name);

        expect(guard).toHaveBeenCalledOnce();
        expect(router.post).not.toHaveBeenCalled();
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});

describe('the passkeys card', () => {
    it('keeps the list back before the password is confirmed and asks for it to show the passkeys', async () => {
        behindTheGate(<PasskeysCard passkeys={null} />);

        const card = screen.getByRole('region', { name: 'Passkeys' });

        expect(
            within(card).getByText(
                'Confirm your password to see your passkeys.',
            ),
        ).toBeTruthy();
        expect(within(card).queryByRole('list')).toBeNull();
        expect(within(card).queryByText('No passkeys yet')).toBeNull();

        await press('Show my passkeys');

        expect(guard).toHaveBeenCalledOnce();
    });

    it('opens the form of a new passkey only once the gate lets it, before and after the confirmation', async () => {
        const { rerender } = behindTheGate(<PasskeysCard passkeys={null} />);

        await press('Add passkey');

        expect(guard).toHaveBeenCalledOnce();
        expect(screen.queryByRole('dialog')).toBeNull();

        rerender(
            <PasswordGateContext.Provider value={{ guard }}>
                <PasskeysCard passkeys={[laptop]} />
            </PasswordGateContext.Provider>,
        );
        held[0]();

        expect(
            await screen.findByRole('dialog', { name: 'Add passkey' }),
        ).toBeTruthy();
    });

    it('sends the removal of a passkey through the gate first', async () => {
        behindTheGate(<PasskeysCard passkeys={[laptop]} />);

        await press('Remove Chrome on Mac');

        expect(guard).toHaveBeenCalledOnce();
        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(router.delete).not.toHaveBeenCalled();
    });
});

describe('the API tokens before the password is confirmed', () => {
    it('keeps the list back and asks for the password to show the tokens', async () => {
        behindTheGate(<TokenList tokens={null} />);

        expect(
            screen.getByText('Confirm your password to see your tokens.'),
        ).toBeTruthy();
        expect(screen.queryByText('No API tokens yet.')).toBeNull();
        expect(screen.queryByRole('table')).toBeNull();

        await press('Show my tokens');

        expect(guard).toHaveBeenCalledOnce();
    });

    it('keeps the address of the server back and asks for the password to show it', async () => {
        behindTheGate(<ServerUrl mcpUrl={null} />);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();

        await press('Show the server URL');

        expect(guard).toHaveBeenCalledOnce();
    });

    it('draws the creation form, and creates the token only once the gate lets it', async () => {
        behindTheGate(
            <CreateTokenForm
                teamGroups={null}
                expirationOptions={[{ value: '90_days', label: '90 days' }]}
                defaultExpiration="90_days"
                mcpUrl={null}
                newToken={null}
                onDone={vi.fn()}
            />,
        );

        await userEvent.type(screen.getByLabelText(/^Token name/), 'Laptop');
        await press('Create token');

        expect(guard).toHaveBeenCalledOnce();
        expect(form.submit).not.toHaveBeenCalled();

        held[0]();

        expect(form.submit).toHaveBeenCalledOnce();
    });

    it('asks for the password before it lists the teams a token may be limited to', async () => {
        behindTheGate(
            <CreateTokenForm
                teamGroups={null}
                expirationOptions={[{ value: '90_days', label: '90 days' }]}
                defaultExpiration="90_days"
                mcpUrl={null}
                newToken={null}
                onDone={vi.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', { name: 'Team' }));

        expect(guard).toHaveBeenCalledOnce();
        expect(screen.queryByRole('listbox')).toBeNull();

        act(() => held[0]());

        expect(await screen.findByRole('listbox')).toBeTruthy();
    });
});

describe('the API tokens once the list is shown', () => {
    it('sends a revocation through the gate first', async () => {
        behindTheGate(<TokenList tokens={[activeToken]} />);

        await userEvent.click(
            within(screen.getByRole('table')).getByRole('button', {
                name: /^Revoke/,
            }),
        );

        expect(guard).toHaveBeenCalledOnce();
        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(router.delete).not.toHaveBeenCalled();
    });
});
