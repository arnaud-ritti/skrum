import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function ShowInviteLink() {
    const { t } = useTrans();

    return (
        <AuthLayout variant="centered" title={t('Invitation')} literalTitle>
            <Head title={t('Invitation')} />
        </AuthLayout>
    );
}
