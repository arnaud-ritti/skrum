import { Head } from '@inertiajs/react';
import { AdminShell } from '@/components/admin/admin-shell';
import { useTrans } from '@/hooks/use-trans';

export default function AdminGeneral() {
    const { t } = useTrans();

    return (
        <AdminShell active="general">
            <Head title={t('General')} />
            <h2 className="text-lg font-semibold">{t('General')}</h2>
        </AdminShell>
    );
}
