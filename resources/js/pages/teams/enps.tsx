import { Head } from '@inertiajs/react';
import { InsightsTabs } from '@/components/teams/insights-tabs';
import { TeamEnpsPage } from '@/components/teams/team-enps-page';
import type { TeamEnpsPageProps } from '@/components/teams/team-enps-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import type { TeamSummary, WorkspaceSummary } from '@/types';

type Props = TeamEnpsPageProps & {
    workspace: WorkspaceSummary;
    team: TeamSummary;
};

export default function TeamEnps({ workspace, team, ...enps }: Props) {
    const { t } = useTrans();

    return (
        <AppLayout active="insights" title={t('Insights')}>
            <Head title={`eNPS · ${team.name}`} />
            <InsightsTabs workspace={workspace} team={team} active="enps" />
            <TeamEnpsPage {...enps} />
        </AppLayout>
    );
}
