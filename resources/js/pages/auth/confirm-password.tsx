import { Head } from '@inertiajs/react';
import { BrandAside } from '@/components/auth/brand-aside';
import { ConfirmPasswordForm } from '@/components/auth/confirm-password-form';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function ConfirmPassword() {
    const { t } = useTrans();

    return (
        <AuthLayout
            title={t('Confirm password')}
            description={t(
                'This is a secure area of the application. Please confirm your password before continuing.',
            )}
            aside={<BrandAside />}
        >
            <Head title={t('Confirm password')} />
            <ConfirmPasswordForm />
        </AuthLayout>
    );
}
