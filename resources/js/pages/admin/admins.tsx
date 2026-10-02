import { Head } from '@inertiajs/react';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminsPanel } from '@/components/admin/admins/admins-panel';
import type { InstanceAdmin } from '@/components/admin/admins/types';
import { useTrans } from '@/hooks/use-trans';

export default function AdminAdmins({ admins }: { admins: InstanceAdmin[] }) {
    const { t } = useTrans();

    return (
        <AdminShell active="admins">
            <Head title={t('Instance admins')} />
            <AdminsPanel admins={admins} />
        </AdminShell>
    );
}
