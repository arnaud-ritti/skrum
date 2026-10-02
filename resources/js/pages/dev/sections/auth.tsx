import type { ReactNode } from 'react';
import { AuthAside } from '@/components/auth/auth-aside';
import { PasskeySignIn } from '@/components/auth/passkey-sign-in';
import { PasswordField } from '@/components/auth/password-field';
import { SsoButtons } from '@/components/auth/sso-buttons';
import type { BenchGroup } from '@/components/dev/bench';
import { AuthFrame } from '@/components/skrum/frames';
import { TextField } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { SsoProviderOption } from '@/types';

export const group: BenchGroup = 'layouts';

const providers: SsoProviderOption[] = [
    { key: 'oidc', label: 'SSO (OIDC)' },
    { key: 'google', label: 'Google' },
    { key: 'github', label: 'GitHub' },
];

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function AuthSection() {
    const { t } = useTrans();

    return (
        <>
            <AuthFrame
                title={t('Log in to your account')}
                description={t('Enter your email and password below to log in')}
                aside={<AuthAside />}
            >
                <div className="flex min-w-0 flex-col gap-4">
                    <SsoButtons providers={providers} />
                    <PasskeySignIn />
                    <TextField
                        id="email"
                        type="email"
                        label={t('Email address')}
                        placeholder={t('email@example.com')}
                    />
                    <PasswordField id="password" label={t('Password')} />
                    <Button size="lg" className="w-full">
                        {t('Log in')}
                    </Button>
                </div>
            </AuthFrame>
            <div className="grid items-start gap-6 p-6 md:grid-cols-2 md:p-10 lg:grid-cols-3">
                <State label={t('A single provider')}>
                    <SsoButtons providers={providers.slice(0, 1)} />
                </State>
                <State label={t('Two providers')}>
                    <SsoButtons
                        providers={[
                            { key: 'entra', label: 'Microsoft Entra ID' },
                            { key: 'google', label: 'Google' },
                        ]}
                    />
                </State>
                <State label={t('Passkey, password confirmation')}>
                    <PasskeySignIn
                        label={t('Confirm with passkey')}
                        loadingLabel={t('Confirming...')}
                        separator={t('Or confirm with password')}
                    />
                </State>
                <State label={t('Field in error')}>
                    <PasswordField
                        id="password-error"
                        label={t('Password')}
                        defaultValue="atlas-sprint-42"
                        error={t('The provided password is incorrect.')}
                    />
                </State>
                <State label={t('Disabled')}>
                    <PasswordField
                        id="password-disabled"
                        label={t('Password')}
                        defaultValue="atlas-sprint-42"
                        disabled
                    />
                </State>
            </div>
        </>
    );
}
