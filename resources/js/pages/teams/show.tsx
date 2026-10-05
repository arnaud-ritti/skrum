import { Head } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import { TeamPage } from '@/components/teams/team-page';
import type { TeamPageProps } from '@/components/teams/team-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function ShowTeam(props: TeamPageProps) {
    const { t } = useTrans();
    const { workspace, team } = props;
    const workspaceHref = WorkspacesController.show(workspace.slug);

    return (
        <AppLayout
            active="dashboard"
            breadcrumbs={[
                { title: workspace.name, href: workspaceHref },
                { title: t('Teams'), href: workspaceHref },
                {
                    title: team.name,
                    href: TeamsController.show({
                        workspace: workspace.slug,
                        team: team.id,
                    }),
                },
            ]}
        >
            <Head title={team.name} />
            <TeamPage {...props} />
        </AppLayout>
    );
}
