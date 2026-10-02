import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { BrandAside } from '@/components/auth/brand-aside';
import { TwoFactorForm } from '@/components/auth/two-factor-form';
import type { TwoFactorMode } from '@/components/auth/two-factor-form';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function TwoFactorChallenge() {
    const { t } = useTrans();
    const [mode, setMode] = useState<TwoFactorMode>('code');

    return (
        <AuthLayout
            title={
                mode === 'recovery'
                    ? t('Recovery code')
                    : t('Authentication code')
            }
            literalTitle
            description={
                mode === 'recovery'
                    ? t(
                          'Please confirm access to your account by entering one of your emergency recovery codes.',
                      )
                    : t(
                          'Enter the authentication code provided by your authenticator application.',
                      )
            }
            aside={<BrandAside />}
        >
            <Head title={t('Two-factor authentication')} />
            <TwoFactorForm mode={mode} onModeChange={setMode} />
        </AuthLayout>
    );
}
