import { Head } from '@inertiajs/react';
import { AdminShell } from '@/components/admin/admin-shell';
import { useTrans } from '@/hooks/use-trans';

export default function AdminIntegrations() {
    const { t } = useTrans();

    return (
        <AdminShell active="integrations">
            <Head title={t('Integrations')} />
            <h2 className="text-lg font-semibold">{t('Integrations')}</h2>
        </AdminShell>
    );
}
