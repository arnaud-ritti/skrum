import { Form, Link } from '@inertiajs/react';
import { authLinkClass } from '@/components/auth/auth-link';
import { PasswordField } from '@/components/auth/password-field';
import { SsoButtons } from '@/components/auth/sso-buttons';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';
import { store } from '@/routes/register';
import type { SsoProviderOption } from '@/types';

export type RegisterFormProps = {
    /** The server's password rule, as a `passwordrules` attribute value. */
    passwordRules: string;
    invitationEmail: string | null;
    ssoProviders: SsoProviderOption[];
};

/** The minimum length the server's rule asks for, when it asks for one. */
export function minimumLength(passwordRules: string): number | null {
    const match = /minlength:\s*(\d+)/.exec(passwordRules);

    return match === null ? null : Number(match[1]);
}

export function RegisterForm({
    passwordRules,
    invitationEmail,
    ssoProviders,
}: RegisterFormProps) {
    const { t } = useTrans();
    const minimum = minimumLength(passwordRules);

    return (
        <div data-slot="register-form" className="flex min-w-0 flex-col gap-4">
            <SsoButtons providers={ssoProviders} />

            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex min-w-0 flex-col gap-4"
            >
                {({ processing, errors }) => (
                    <>
                        <TextField
                            id="name"
                            name="name"
                            type="text"
                            label={t('First and last name')}
                            required
                            autoFocus
                            autoComplete="name"
                            error={errors.name}
                            className="max-md:h-12"
                        />

                        <TextField
                            id="email"
                            name="email"
                            type="email"
                            label={t('Work email')}
                            required
                            autoComplete="email"
                            placeholder={t('email@example.com')}
                            defaultValue={invitationEmail ?? undefined}
                            readOnly={invitationEmail !== null}
                            description={
                                invitationEmail === null
                                    ? undefined
                                    : t(
                                          'The invitation was sent to this address.',
                                      )
                            }
                            error={errors.email}
                            className="max-md:h-12"
                        />

                        <PasswordField
                            id="password"
                            name="password"
                            label={t('Password')}
                            required
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
                            data-test="register-user-button"
                        >
                            <span className="truncate">
                                {t('Create my account')}
                            </span>
                        </LoadingButton>
                    </>
                )}
            </Form>

            <p className="text-center text-sm text-muted-foreground">
                {t('Already registered?')}{' '}
                <Link href={login()} className={authLinkClass}>
                    {t('Log in')}
                </Link>
            </p>
        </div>
    );
}
