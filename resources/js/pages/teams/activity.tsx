import { Head } from '@inertiajs/react';
import { ActivityPage } from '@/components/teams/activity-page';
import type { ActivityPageProps } from '@/components/teams/activity-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function TeamActivity(props: ActivityPageProps) {
    const { t } = useTrans();

    return (
        <AppLayout active="activity" title={t('Activity')}>
            <Head title={`${t('Activity')} · ${props.team.name}`} />
            <ActivityPage {...props} />
        </AppLayout>
    );
}
