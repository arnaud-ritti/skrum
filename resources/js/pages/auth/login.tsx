import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { BrandAside } from '@/components/auth/brand-aside';
import { LoginForm } from '@/components/auth/login-form';
import type { LoginFormProps } from '@/components/auth/login-form';
import { MagicLinkSent } from '@/components/auth/magic-link-request';
import { useInstanceHost } from '@/hooks/use-instance-host';
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
    const { brand } = usePage().props;
    const host = useInstanceHost();
    const instanceLine = [host, t(':name instance', { name: brand.name })]
        .filter(Boolean)
        .join(' · ');

    if (linkSentTo !== null) {
        return (
            <AuthLayout title={t('Log in')} variant="centered">
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
            description={t("Log in to find your teams' sessions and actions.")}
            aside={<BrandAside />}
            phoneIntro={instanceLine}
        >
            <Head title={t('Log in')} />
            <LoginForm {...props} onMagicLinkSent={setLinkSentTo} />
        </AuthLayout>
    );
}
