import { Head } from '@inertiajs/react';
import { BrandAside } from '@/components/auth/brand-aside';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';
import type { VerifyEmailFormProps } from '@/components/auth/verify-email-form';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function VerifyEmail(props: VerifyEmailFormProps) {
    const { t } = useTrans();

    return (
        <AuthLayout
            title={t('Email verification')}
            literalTitle
            description={t(
                'Please verify your email address by clicking on the link we just emailed to you.',
            )}
            aside={<BrandAside />}
        >
            <Head title={t('Email verification')} />
            <VerifyEmailForm {...props} />
        </AuthLayout>
    );
}
