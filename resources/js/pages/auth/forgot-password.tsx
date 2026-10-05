import { Head } from '@inertiajs/react';
import { BrandAside } from '@/components/auth/brand-aside';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import type { ForgotPasswordFormProps } from '@/components/auth/forgot-password-form';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function ForgotPassword(props: ForgotPasswordFormProps) {
    const { t } = useTrans();

    return (
        <AuthLayout
            title={t('Forgot password')}
            description={t('Enter your email to receive a password reset link')}
            aside={<BrandAside />}
        >
            <Head title={t('Forgot password')} />
            <ForgotPasswordForm {...props} />
        </AuthLayout>
    );
}
