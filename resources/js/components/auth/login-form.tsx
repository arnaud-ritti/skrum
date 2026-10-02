import { Form, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { AuthSeparator } from '@/components/auth/auth-separator';
import { PasskeySignIn } from '@/components/auth/passkey-sign-in';
import { PasswordField } from '@/components/auth/password-field';
import { SsoButtons } from '@/components/auth/sso-buttons';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useTrans } from '@/hooks/use-trans';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import type { SsoProviderOption } from '@/types';

export const authLinkClass =
    'rounded-xs font-medium text-skrum-primary-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export type LoginFormProps = {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
    ssoProviders: SsoProviderOption[];
    /** Place left for the phone's "Magic link / Password" tab strip (plan 18f, B12). */
    methodTabs?: ReactNode;
    /** Place left for the "Receive a magic link instead" button (plan 18f, B12). */
    magicLink?: ReactNode;
};

export function LoginForm({
    status,
    canResetPassword,
    canRegister,
    ssoProviders,
    methodTabs,
    magicLink,
}: LoginFormProps) {
    const { t } = useTrans();

    return (
        <div data-slot="login-form" className="flex min-w-0 flex-col gap-4">
            {status && <Alert variant="success" title={status} />}

            <SsoButtons providers={ssoProviders} separator={false} />
            <PasskeySignIn
                whenUnsupported={
                    ssoProviders.length > 0 ? (
                        <AuthSeparator label={t('or with your e-mail')} />
                    ) : null
                }
            />

            {methodTabs !== undefined && (
                <div data-slot="login-method-tabs" className="min-w-0">
                    {methodTabs}
                </div>
            )}

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex min-w-0 flex-col gap-4"
            >
                {({ processing, errors }) => (
                    <>
                        <TextField
                            id="email"
                            name="email"
                            type="email"
                            label={t('Work email')}
                            required
                            autoFocus
                            autoComplete="email"
                            placeholder={t('email@example.com')}
                            error={errors.email}
                            className="max-md:h-12"
                        />

                        <div className="relative min-w-0">
                            <PasswordField
                                id="password"
                                name="password"
                                label={t('Password')}
                                required
                                autoComplete="current-password"
                                error={errors.password}
                                className="max-md:h-12"
                            />
                            {canResetPassword && (
                                <Link
                                    href={request()}
                                    className={`${authLinkClass} absolute top-0 right-0 text-sm/none`}
                                >
                                    {t('Forgot your password?')}
                                </Link>
                            )}
                        </div>

                        <Checkbox
                            id="remember"
                            name="remember"
                            label={t('Remember me')}
                        />

                        <LoadingButton
                            type="submit"
                            size="lg"
                            className="w-full"
                            loading={processing}
                            data-test="login-button"
                        >
                            <span className="truncate">{t('Log in')}</span>
                        </LoadingButton>
                    </>
                )}
            </Form>

            {magicLink !== undefined && (
                <div data-slot="login-magic-link" className="min-w-0">
                    {magicLink}
                </div>
            )}

            {canRegister && (
                <p className="text-center text-sm text-muted-foreground">
                    {t("Don't have an account?")}{' '}
                    <Link href={register()} className={authLinkClass}>
                        {t('Create an account')}
                    </Link>
                </p>
            )}
        </div>
    );
}
