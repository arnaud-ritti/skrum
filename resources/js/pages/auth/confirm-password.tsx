import { Head, router } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import CodeConfirmationsController from '@/actions/App/Http/Controllers/Settings/CodeConfirmationsController';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import { EmailCodeConfirmation } from '@/components/auth/email-code-confirmation';
import { PasskeySignIn } from '@/components/auth/passkey-sign-in';
import { PasswordField } from '@/components/auth/password-field';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';
import { dashboard } from '@/routes';
import { store } from '@/routes/password/confirm';

export default function ConfirmPassword({
    confirmsWith,
}: {
    /** An account whose owner knows no password confirms with a code sent by e-mail. */
    confirmsWith: 'password' | 'code';
}) {
    const { t } = useTrans();
    const [refusal, setRefusal] = useState<string>();
    const [failure, setFailure] = useState<string>();
    const title =
        confirmsWith === 'code'
            ? t('Confirm it is you')
            : t('Confirm your password');

    const cancel = (open: boolean): void => {
        if (!open) {
            router.visit(dashboard());
        }
    };

    const confirm = (data: FormData): Promise<void> => {
        const field = confirmsWith === 'code' ? 'code' : 'password';
        const value = data.get(field);

        setRefusal(undefined);
        setFailure(undefined);

        return new Promise((resolve, reject) => {
            let accepted = false;
            let refused = false;

            router.post(
                confirmsWith === 'code'
                    ? CodeConfirmationsController.store.url()
                    : store.url(),
                { [field]: typeof value === 'string' ? value : '' },
                {
                    onSuccess: () => {
                        accepted = true;
                    },
                    onError: (errors) => {
                        refused = true;
                        setRefusal(errors[field]);
                        document.getElementById('password')?.focus();
                    },
                    onFinish: () => {
                        if (!accepted) {
                            if (!refused) {
                                setFailure(
                                    t(
                                        'Something went wrong. Please try again.',
                                    ),
                                );
                            }

                            reject(new Error('The confirmation was refused.'));

                            return;
                        }

                        resolve();
                    },
                },
            );
        });
    };

    return (
        <>
            <Head title={title} />
            <FormDialog
                open
                closeOnSuccess={false}
                onOpenChange={cancel}
                title={title}
                description={
                    confirmsWith === 'code'
                        ? t(
                              'This action is protected. Enter the code we email you to continue.',
                          )
                        : t(
                              'This action is protected. Confirm your password to continue.',
                          )
                }
                submitLabel={
                    confirmsWith === 'code'
                        ? t('Confirm')
                        : t('Confirm password')
                }
                submitIcon={ShieldCheck}
                submitTest={
                    confirmsWith === 'code'
                        ? 'confirm-code-button'
                        : 'confirm-password-button'
                }
                onSubmit={confirm}
                error={failure}
            >
                {confirmsWith === 'code' ? (
                    <EmailCodeConfirmation error={refusal} />
                ) : (
                    <>
                        <PasskeySignIn
                            routes={{
                                options: confirmOptions(),
                                submit: confirmStore(),
                            }}
                            label={t('Confirm with passkey')}
                            loadingLabel={t('Confirming…')}
                            separator={t('Or confirm with password')}
                        />
                        <PasswordField
                            id="password"
                            name="password"
                            label={t('Password')}
                            required
                            autoFocus
                            autoComplete="current-password"
                            error={refusal}
                        />
                    </>
                )}
            </FormDialog>
        </>
    );
}
