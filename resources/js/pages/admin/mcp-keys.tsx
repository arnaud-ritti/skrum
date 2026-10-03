import { Head } from '@inertiajs/react';
import { AdminShell } from '@/components/admin/admin-shell';
import { useTrans } from '@/hooks/use-trans';

export default function AdminMcpKeys() {
    const { t } = useTrans();

    return (
        <AdminShell active="mcpKeys">
            <Head title={t('MCP keys')} />
            <h2 className="text-lg font-semibold">{t('MCP keys')}</h2>
        </AdminShell>
    );
}
