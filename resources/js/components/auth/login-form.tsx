import { Form, Link } from '@inertiajs/react';
import { useRef, useState } from 'react';
import JoinCodesController from '@/actions/App/Http/Controllers/JoinCodesController';
import { AdminSignInDisclosure } from '@/components/auth/admin-sign-in-disclosure';
import { authLinkClass } from '@/components/auth/auth-link';
import { AuthSeparator } from '@/components/auth/auth-separator';
import { MagicLinkButton } from '@/components/auth/magic-link-request';
import { PasskeySignIn } from '@/components/auth/passkey-sign-in';
import { PasswordField } from '@/components/auth/password-field';
import { SsoButtons } from '@/components/auth/sso-buttons';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import type { SsoProviderOption } from '@/types';

type SignInMethod = 'magic-link' | 'password';

export type LoginFormProps = {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
    ssoProviders: SsoProviderOption[];
    /** False when mail does not deliver or local credentials are closed. */
    canUseMagicLink?: boolean;
    /**
     * Only single sign-on signs in: the password form is folded under
     * "Administrator sign-in", for every visitor alike.
     */
    ssoRequired?: boolean;
    /** Called with the address typed once the request for a link was accepted. */
    onMagicLinkSent?: (email: string) => void;
};

export function LoginForm({
    status,
    canResetPassword,
    canRegister,
    ssoProviders,
    canUseMagicLink = false,
    ssoRequired = false,
    onMagicLinkSent,
}: LoginFormProps) {
    const { t } = useTrans();
    const isPhone = useIsMobile();
    const magicLinkButton = useRef<HTMLButtonElement>(null);
    const [email, setEmail] = useState('');
    const [method, setMethod] = useState<SignInMethod>('password');
    const [addressMissing, setAddressMissing] = useState(false);
    const mayUseMagicLink = canUseMagicLink && !ssoRequired;
    const hasMethodTabs = mayUseMagicLink && isPhone;
    const asksForLinkOnly = hasMethodTabs && method === 'magic-link';
    const offersMagicLink = mayUseMagicLink && (!isPhone || asksForLinkOnly);
    const visibleStatus = status === 'magic-link-sent' ? undefined : status;

    const passwordForm = (
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
                        autoFocus={!ssoRequired}
                        autoComplete="email"
                        placeholder={t('email@example.com')}
                        description={
                            asksForLinkOnly
                                ? t(
                                      'We send you a sign-in link valid for 15 minutes.',
                                  )
                                : undefined
                        }
                        error={
                            errors.email ??
                            (addressMissing
                                ? t('Enter your e-mail address first.')
                                : undefined)
                        }
                        className="max-md:h-12"
                        onChange={(event) => {
                            setEmail(event.target.value);
                            setAddressMissing(false);
                        }}
                        onKeyDown={(event) => {
                            if (asksForLinkOnly && event.key === 'Enter') {
                                event.preventDefault();
                                magicLinkButton.current?.click();
                            }
                        }}
                    />

                    {!asksForLinkOnly && (
                        <>
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

                            {!ssoRequired && (
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    label={t('Remember me')}
                                />
                            )}

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
                </>
            )}
        </Form>
    );

    return (
        <div data-slot="login-form" className="flex min-w-0 flex-col gap-4">
            {visibleStatus && <Alert variant="success" title={visibleStatus} />}

            <SsoButtons providers={ssoProviders} separator={false} />
            {ssoRequired ? (
                <p
                    data-slot="login-sso-only"
                    className="text-center text-sm text-muted-foreground"
                >
                    {t('This instance signs in with single sign-on only.')}
                </p>
            ) : (
                <PasskeySignIn
                    whenUnsupported={
                        ssoProviders.length > 0 ? (
                            <AuthSeparator label={t('or with your e-mail')} />
                        ) : null
                    }
                />
            )}

            {hasMethodTabs && (
                <Tabs
                    data-slot="login-method-tabs"
                    value={method}
                    onValueChange={setMethod}
                    fullWidth
                >
                    <TabsList aria-label={t('Sign-in method')} className="h-11">
                        <TabsTrigger value="magic-link" className="h-9.5">
                            {t('Magic link')}
                        </TabsTrigger>
                        <TabsTrigger value="password" className="h-9.5">
                            {t('Password')}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            )}

            {ssoRequired ? (
                <AdminSignInDisclosure>{passwordForm}</AdminSignInDisclosure>
            ) : (
                passwordForm
            )}

            {offersMagicLink && (
                <div data-slot="login-magic-link" className="min-w-0">
                    <MagicLinkButton
                        ref={magicLinkButton}
                        variant={asksForLinkOnly ? 'primary' : 'ghost'}
                        email={email}
                        onMissingAddress={() => {
                            setAddressMissing(true);
                            document.getElementById('email')?.focus();
                        }}
                        onSent={() => onMagicLinkSent?.(email)}
                    />
                </div>
            )}

            {canRegister && !ssoRequired && (
                <p className="text-center text-sm text-muted-foreground">
                    {t("Don't have an account?")}{' '}
                    <Link href={register()} className={authLinkClass}>
                        {t('Create an account')}
                    </Link>
                </p>
            )}

            <p
                data-slot="login-join-code"
                className="text-center text-sm text-muted-foreground"
            >
                <Link
                    href={JoinCodesController.create.url()}
                    className={authLinkClass}
                >
                    {t('Join a session with a code')}
                </Link>
            </p>
        </div>
    );
}
