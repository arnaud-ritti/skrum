import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { BrandAside } from '@/components/auth/brand-aside';
import { LoginForm } from '@/components/auth/login-form';
import type { LoginFormProps } from '@/components/auth/login-form';
import { MagicLinkSent } from '@/components/auth/magic-link-request';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

type Props = Pick<
    LoginFormProps,
    | 'status'
    | 'canResetPassword'
    | 'canRegister'
    | 'ssoProviders'
    | 'canUseMagicLink'
    | 'ssoRequired'
>;

export default function Login(props: Props) {
    const { t } = useTrans();
    const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

    if (linkSentTo !== null) {
        return (
            <AuthLayout title={t('Log in')} literalTitle variant="centered">
                <Head title={t('Log in')} />
                <MagicLinkSent
                    email={linkSentTo}
                    onUseAnotherAddress={() => setLinkSentTo(null)}
                />
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title={t('Welcome back')}
            literalTitle
            description={t("Log in to find your teams' sessions and actions.")}
            aside={<BrandAside />}
        >
            <Head title={t('Log in')} />
            <LoginForm {...props} onMagicLinkSent={setLinkSentTo} />
        </AuthLayout>
    );
}
