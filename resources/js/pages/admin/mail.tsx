import { Head } from '@inertiajs/react';
import { AdminShell } from '@/components/admin/admin-shell';
import { useTrans } from '@/hooks/use-trans';

export default function AdminMail() {
    const { t } = useTrans();

    return (
        <AdminShell active="mail">
            <Head title={t('SMTP')} />
            <h2 className="text-lg font-semibold">{t('SMTP')}</h2>
        </AdminShell>
    );
}
