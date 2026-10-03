import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function TeamSessions() {
    const { t } = useTrans();

    return (
        <AppLayout active="sessions">
            <Head title={t('Sessions')} />
            <h1 className="text-2xl font-title">{t('Sessions')}</h1>
        </AppLayout>
    );
}
