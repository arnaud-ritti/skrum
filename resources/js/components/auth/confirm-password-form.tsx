import { Form } from '@inertiajs/react';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import { PasskeySignIn } from '@/components/auth/passkey-sign-in';
import { PasswordField } from '@/components/auth/password-field';
import { LoadingButton } from '@/components/skrum/loading-button';
import { useTrans } from '@/hooks/use-trans';
import { store } from '@/routes/password/confirm';

export function ConfirmPasswordForm() {
    const { t } = useTrans();

    return (
        <div
            data-slot="confirm-password-form"
            className="flex min-w-0 flex-col gap-4"
        >
            <PasskeySignIn
                routes={{ options: confirmOptions(), submit: confirmStore() }}
                label={t('Confirm with passkey')}
                loadingLabel={t('Confirming…')}
                separator={t('Or confirm with password')}
            />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex min-w-0 flex-col gap-4"
            >
                {({ processing, errors }) => (
                    <>
                        <PasswordField
                            id="password"
                            name="password"
                            label={t('Password')}
                            required
                            autoFocus
                            autoComplete="current-password"
                            error={errors.password}
                            className="max-md:h-12"
                        />

                        <LoadingButton
                            type="submit"
                            size="lg"
                            className="w-full"
                            loading={processing}
                            data-test="confirm-password-button"
                        >
                            <span className="truncate">
                                {t('Confirm password')}
                            </span>
                        </LoadingButton>
                    </>
                )}
            </Form>
        </div>
    );
}
