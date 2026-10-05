import { Head } from '@inertiajs/react';
import { InsightsTabs } from '@/components/teams/insights-tabs';
import { TeamHealthCheckPage } from '@/components/teams/team-health-check-page';
import type { TeamHealthCheckPageProps } from '@/components/teams/team-health-check-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function TeamHealthCheck(props: TeamHealthCheckPageProps) {
    const { t } = useTrans();
    const { workspace, team } = props;

    return (
        <AppLayout active="insights" title={t('Insights')}>
            <Head title={`${t('Health check')} · ${team.name}`} />
            <InsightsTabs workspace={workspace} team={team} active="health" />
            <TeamHealthCheckPage {...props} />
        </AppLayout>
    );
}
