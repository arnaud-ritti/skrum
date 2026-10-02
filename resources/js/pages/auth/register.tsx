import { Head } from '@inertiajs/react';
import { BrandAside } from '@/components/auth/brand-aside';
import { RegisterForm } from '@/components/auth/register-form';
import type { RegisterFormProps } from '@/components/auth/register-form';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function Register(props: RegisterFormProps) {
    const { t } = useTrans();

    return (
        <AuthLayout
            title={t('Create your account')}
            literalTitle
            description={t('Enter your details below to create your account')}
            aside={<BrandAside />}
        >
            <Head title={t('Register')} />
            <RegisterForm {...props} />
        </AuthLayout>
    );
}
