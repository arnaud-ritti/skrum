import { router, useHttp } from '@inertiajs/react';
import { usePasskeyVerify } from '@laravel/passkeys/react';
import { CircleAlert, KeyRound, ShieldCheck } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
    index as passkeyOptions,
    store as confirmWithPasskey,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import { AuthSeparator } from '@/components/auth/auth-separator';
import { PasswordField } from '@/components/auth/password-field';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { useTrans } from '@/hooks/use-trans';
import { confirmation as confirmationStatus } from '@/routes/password';
import { store as confirmPassword } from '@/routes/password/confirm';

/** The props of the account settings the server sends only behind a confirmed password. */
export const ProtectedProps = ['security', 'apiTokens'] as const;

type PasswordGate = {
    /**
     * Runs the action once the server accepts the password confirmation of
     * the session. When it does not, the password is asked in a dialog
     * first, and the action is dropped if the reader gives up.
     */
    guard: (action: () => void) => void;
};

/** Without the gate of the page around it, a card runs its actions and leaves the refusal to the server. */
export const PasswordGateContext = createContext<PasswordGate>({
    guard: (action) => action(),
});

export function usePasswordGate(): PasswordGate {
    return useContext(PasswordGateContext);
}

function loadProtectedProps(): Promise<void> {
    return new Promise((resolve) => {
        router.reload({
            only: [...ProtectedProps],
            onFinish: () => resolve(),
        });
    });
}

function PasskeyConfirmation({
    onConfirmed,
}: {
    onConfirmed: () => void;
}): ReactElement | null {
    const { t } = useTrans();
    const { verify, isLoading, error, isSupported } = usePasskeyVerify({
        routes: {
            options: passkeyOptions.url(),
            submit: confirmWithPasskey.url(),
        },
        onSuccess: onConfirmed,
    });

    if (!isSupported) {
        return null;
    }

    return (
        <div
            data-slot="passkey-confirmation"
            className="flex min-w-0 flex-col gap-4"
        >
            <div className="flex min-w-0 flex-col gap-1.5">
                <LoadingButton
                    type="button"
                    variant="outline"
                    className="w-full"
                    loading={isLoading}
                    onClick={verify}
                >
                    <KeyRound aria-hidden="true" />
                    <span className="truncate">
                        {isLoading
                            ? t('Confirming...')
                            : t('Confirm with passkey')}
                    </span>
                </LoadingButton>
                {error !== null && (
                    <p
                        role="alert"
                        data-slot="passkey-error"
                        className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text"
                    >
                        <CircleAlert
                            aria-hidden="true"
                            className="size-4 shrink-0"
                        />
                        {error}
                    </p>
                )}
            </div>
            <AuthSeparator label={t('Or confirm with password')} />
        </div>
    );
}

/**
 * The gate of the account settings: each protected action of the page goes
 * through it. It asks the server whether the confirmation of the session
 * still holds, asks for the password in a dialog when it does not, then
 * loads what the server kept back and lets the action go.
 */
export function PasswordGateProvider({
    locked,
    passkeys,
    needsConfirmation,
    children,
}: {
    /** The server kept the protected props back on the last load. */
    locked: boolean;
    /** The instance offers passkeys: one may stand for the password. */
    passkeys: boolean;
    /**
     * False for an account without a password its owner knows: the server
     * asks it no confirmation in the account settings (rule S-1, the
     * owner's accepted risk), so the gate opens no dialog either.
     */
    needsConfirmation: boolean;
    children: ReactNode;
}): ReactElement {
    const { t } = useTrans();
    const status = useHttp<Record<string, never>, { confirmed?: boolean }>();
    const confirmation = useHttp<{ password: string }>({ password: '' });
    const [open, setOpen] = useState(false);
    const [refusal, setRefusal] = useState<string>();
    const [failure, setFailure] = useState<string>();
    const pending = useRef<(() => void) | null>(null);
    const confirmed = useRef(false);
    const keptBack = useRef(locked);

    useEffect(() => {
        keptBack.current = locked;
    }, [locked]);

    const guard = (action: () => void): void => {
        void (async () => {
            if (!needsConfirmation) {
                if (keptBack.current) {
                    await loadProtectedProps();
                }

                action();

                return;
            }

            let accepted = false;

            try {
                const answer = await status.submit(confirmationStatus());

                accepted = answer?.confirmed === true;
            } catch {
                accepted = false;
            }

            if (!accepted) {
                pending.current = action;
                confirmed.current = false;
                setRefusal(undefined);
                setFailure(undefined);
                setOpen(true);

                return;
            }

            if (keptBack.current) {
                await loadProtectedProps();
            }

            action();
        })();
    };

    /** The action waits for the dialog to close: it may open a dialog of its own. */
    const changeOpen = (next: boolean): void => {
        setOpen(next);

        if (next) {
            return;
        }

        const action = pending.current;

        pending.current = null;

        if (confirmed.current && action !== null) {
            action();
        }

        confirmed.current = false;
    };

    const confirm = async (data: FormData): Promise<void> => {
        const password = data.get('password');
        let refused: string | undefined;

        setRefusal(undefined);
        setFailure(undefined);
        confirmation.transform(() => ({
            password: typeof password === 'string' ? password : '',
        }));

        try {
            await confirmation.post(confirmPassword.url(), {
                onSuccess: () => {
                    confirmed.current = true;
                },
                onError: (errors) => {
                    refused = errors.password;
                },
            });
        } catch {
            confirmed.current = false;
        }

        if (!confirmed.current) {
            if (refused === undefined) {
                setFailure(t('Something went wrong. Please try again.'));
            }

            setRefusal(refused);
            document.getElementById('gate-password')?.focus();

            throw new Error('The password was not confirmed.');
        }

        await loadProtectedProps();
    };

    const confirmedWithPasskey = (): void => {
        confirmed.current = true;

        void loadProtectedProps().then(() => changeOpen(false));
    };

    return (
        <PasswordGateContext.Provider value={{ guard }}>
            {children}
            <FormDialog
                open={open}
                onOpenChange={changeOpen}
                title={t('Confirm your password')}
                description={t(
                    'This action is protected. Confirm your password to continue.',
                )}
                submitLabel={t('Confirm password')}
                submitIcon={ShieldCheck}
                submitTest="confirm-password-button"
                onSubmit={confirm}
                error={failure}
            >
                {passkeys && (
                    <PasskeyConfirmation onConfirmed={confirmedWithPasskey} />
                )}
                <PasswordField
                    id="gate-password"
                    name="password"
                    label={t('Password')}
                    required
                    autoFocus
                    autoComplete="current-password"
                    error={refusal}
                />
            </FormDialog>
        </PasswordGateContext.Provider>
    );
}
