import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import EmailChallengeCodesController from '@/actions/App/Http/Controllers/EmailChallengeCodesController';
import { authLinkClass } from '@/components/auth/auth-link';
import { BrandAside } from '@/components/auth/brand-aside';
import { EmailCodeChallenge } from '@/components/auth/email-code-challenge';
import { TwoFactorForm } from '@/components/auth/two-factor-form';
import type { TwoFactorMode } from '@/components/auth/two-factor-form';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';
import { cn } from '@/lib/utils';
import type { EmailCodeChallengeState, SecondFactorMethod } from '@/types/auth';

type Mode = TwoFactorMode | 'email';

type Props = {
    methods?: SecondFactorMethod[];
    emailCode?: EmailCodeChallengeState | null;
};

export default function TwoFactorChallenge({
    methods = ['totp'],
    emailCode = null,
}: Props) {
    const { t } = useTrans();
    const hasApp = methods.includes('totp') || emailCode === null;
    const [mode, setMode] = useState<Mode>(hasApp ? 'code' : 'email');
    const [requestingCode, setRequestingCode] = useState(false);
    const canSwitch = hasApp && emailCode !== null;

    /* The first code leaves when the e-mail method is chosen; the server holds the cooldown. */
    const chooseEmailCode = (): void => {
        router.post(
            EmailChallengeCodesController.store.url(),
            {},
            {
                preserveState: true,
                onStart: () => setRequestingCode(true),
                onSuccess: () => setMode('email'),
                onFinish: () => setRequestingCode(false),
            },
        );
    };

    const titles: Record<Mode, string> = {
        code: t('Authentication code'),
        recovery: t('Recovery code'),
        email: t('Email code'),
    };

    const descriptions: Record<Mode, string> = {
        code: t(
            'Enter the authentication code provided by your authenticator application.',
        ),
        recovery: t(
            'Please confirm access to your account by entering one of your emergency recovery codes.',
        ),
        email: t('Enter the code we sent to your mailbox.'),
    };

    return (
        <AuthLayout
            title={titles[mode]}
            description={descriptions[mode]}
            aside={<BrandAside />}
        >
            <Head title={t('Two-factor authentication')} />
            <div className="flex min-w-0 flex-col gap-4">
                {mode === 'email' && emailCode !== null ? (
                    <EmailCodeChallenge {...emailCode} />
                ) : (
                    <TwoFactorForm
                        mode={mode === 'recovery' ? 'recovery' : 'code'}
                        onModeChange={setMode}
                    />
                )}
                {canSwitch && (
                    <p className="text-center text-sm text-muted-foreground">
                        <button
                            type="button"
                            data-slot="second-factor-method"
                            disabled={requestingCode}
                            className={cn(
                                authLinkClass,
                                'cursor-pointer disabled:cursor-wait disabled:opacity-55',
                            )}
                            onClick={() =>
                                mode === 'email'
                                    ? setMode('code')
                                    : chooseEmailCode()
                            }
                        >
                            {mode === 'email'
                                ? t('Use the authenticator app')
                                : t('Use an email code')}
                        </button>
                    </p>
                )}
            </div>
        </AuthLayout>
    );
}
