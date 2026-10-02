import { Form } from '@inertiajs/react';
import { PasswordField } from '@/components/auth/password-field';
import { minimumLength } from '@/components/auth/register-form';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';
import { update } from '@/routes/password';

export type ResetPasswordFormProps = {
    token: string;
    email: string;
    /** The server's password rule, as a `passwordrules` attribute value. */
    passwordRules: string;
};

export function ResetPasswordForm({
    token,
    email,
    passwordRules,
}: ResetPasswordFormProps) {
    const { t } = useTrans();
    const minimum = minimumLength(passwordRules);

    return (
        <Form
            {...update.form()}
            transform={(data) => ({ ...data, token, email })}
            resetOnSuccess={['password', 'password_confirmation']}
            data-slot="reset-password-form"
            className="flex min-w-0 flex-col gap-4"
        >
            {({ processing, errors }) => (
                <>
                    <TextField
                        id="email"
                        name="email"
                        type="email"
                        label={t('Work email')}
                        autoComplete="email"
                        defaultValue={email}
                        readOnly
                        error={errors.email}
                        className="max-md:h-12"
                    />

                    <PasswordField
                        id="password"
                        name="password"
                        label={t('New password')}
                        required
                        autoFocus
                        autoComplete="new-password"
                        passwordrules={passwordRules}
                        placeholder={
                            minimum === null
                                ? undefined
                                : t(':count characters minimum', {
                                      count: minimum,
                                  })
                        }
                        error={errors.password}
                        className="max-md:h-12"
                    />

                    <PasswordField
                        id="password_confirmation"
                        name="password_confirmation"
                        label={t('Confirm password')}
                        required
                        autoComplete="new-password"
                        passwordrules={passwordRules}
                        error={errors.password_confirmation}
                        className="max-md:h-12"
                    />

                    <LoadingButton
                        type="submit"
                        size="lg"
                        className="w-full"
                        loading={processing}
                        data-test="reset-password-button"
                    >
                        <span className="truncate">{t('Reset password')}</span>
                    </LoadingButton>
                </>
            )}
        </Form>
    );
}
