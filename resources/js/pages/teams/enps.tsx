import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function TeamEnps({ team }: { team: { name: string } }) {
    const { t } = useTrans();

    return (
        <AppLayout active="insights" title={t('Insights')}>
            <Head title={`eNPS · ${team.name}`} />
        </AppLayout>
    );
}
