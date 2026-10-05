import { Head } from '@inertiajs/react';
import { BrandAside } from '@/components/auth/brand-aside';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import type { ResetPasswordFormProps } from '@/components/auth/reset-password-form';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function ResetPassword(props: ResetPasswordFormProps) {
    const { t } = useTrans();

    return (
        <AuthLayout
            title={t('Reset password')}
            description={t('Please enter your new password below')}
            aside={<BrandAside />}
        >
            <Head title={t('Reset password')} />
            <ResetPasswordForm {...props} />
        </AuthLayout>
    );
}
