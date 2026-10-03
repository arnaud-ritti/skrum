import { Head } from '@inertiajs/react';
import { AdminShell } from '@/components/admin/admin-shell';
import { useTrans } from '@/hooks/use-trans';

export default function AdminAuditLog() {
    const { t } = useTrans();

    return (
        <AdminShell active="auditLog">
            <Head title={t('Audit log')} />
            <h2 className="text-lg font-semibold">{t('Audit log')}</h2>
        </AdminShell>
    );
}
