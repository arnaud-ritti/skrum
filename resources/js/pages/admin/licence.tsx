import { Head } from '@inertiajs/react';
import { AdminShell } from '@/components/admin/admin-shell';
import { LicenceCard } from '@/components/admin/licence/licence-card';
import { useTrans } from '@/hooks/use-trans';
import type { LicencePageProps } from '@/lib/admin/types';

export default function AdminLicence({
    licence,
    licenceUrl,
    repositoryUrl,
    accountsInUse,
}: LicencePageProps) {
    const { t } = useTrans();

    return (
        <AdminShell active="licence">
            <Head title={t('Licence')} />
            <div className="flex max-w-3xl min-w-0 flex-col gap-6">
                <LicenceCard
                    licence={licence}
                    licenceUrl={licenceUrl}
                    repositoryUrl={repositoryUrl}
                    accountsInUse={accountsInUse}
                />
            </div>
        </AdminShell>
    );
}
