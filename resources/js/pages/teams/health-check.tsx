import { Head } from '@inertiajs/react';
import TeamHealthChecksController from '@/actions/App/Http/Controllers/TeamHealthChecksController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import { TeamHealthCheckPage } from '@/components/teams/team-health-check-page';
import type { TeamHealthCheckPageProps } from '@/components/teams/team-health-check-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function TeamHealthCheck(props: TeamHealthCheckPageProps) {
    const { t } = useTrans();
    const { workspace, team } = props;
    const workspaceHref = WorkspacesController.show(workspace.slug);
    const scope = { workspace: workspace.slug, team: team.id };

    return (
        <AppLayout
            active="insights"
            breadcrumbs={[
                { title: workspace.name, href: workspaceHref },
                { title: t('Teams'), href: workspaceHref },
                { title: team.name, href: TeamsController.show(scope) },
                {
                    title: t('Health check'),
                    href: TeamHealthChecksController.show(scope),
                },
            ]}
        >
            <Head title={`${t('Health check')} · ${team.name}`} />
            <TeamHealthCheckPage {...props} />
        </AppLayout>
    );
}
