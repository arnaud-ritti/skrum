import { Head } from '@inertiajs/react';
import { AdminShell } from '@/components/admin/admin-shell';
import { useTrans } from '@/hooks/use-trans';

export default function AdminUsers() {
    const { t } = useTrans();

    return (
        <AdminShell active="users">
            <Head title={t('Users')} />
            <h2 className="text-lg font-semibold">{t('Users')}</h2>
        </AdminShell>
    );
}
