import { Head } from '@inertiajs/react';
import { TeamHealthCheckPage } from '@/components/teams/team-health-check-page';
import type { TeamHealthCheckPageProps } from '@/components/teams/team-health-check-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function TeamHealthCheck(props: TeamHealthCheckPageProps) {
    const { t } = useTrans();
    const { team } = props;

    return (
        <AppLayout active="insights" title={t('Insights')}>
            <Head title={`${t('Health check')} · ${team.name}`} />
            <TeamHealthCheckPage {...props} />
        </AppLayout>
    );
}
