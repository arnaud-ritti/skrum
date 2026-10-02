import { Head } from '@inertiajs/react';
import { BrandAside } from '@/components/auth/brand-aside';
import { LoginForm } from '@/components/auth/login-form';
import type { LoginFormProps } from '@/components/auth/login-form';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

type Props = Pick<
    LoginFormProps,
    'status' | 'canResetPassword' | 'canRegister' | 'ssoProviders'
>;

export default function Login(props: Props) {
    const { t } = useTrans();

    return (
        <AuthLayout
            title={t('Welcome back')}
            literalTitle
            description={t("Log in to find your teams' sessions and actions.")}
            aside={<BrandAside />}
        >
            <Head title={t('Log in')} />
            <LoginForm {...props} />
        </AuthLayout>
    );
}
