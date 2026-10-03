import { Head } from '@inertiajs/react';
import TeamSessionsController from '@/actions/App/Http/Controllers/TeamSessionsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { SessionsPage } from '@/components/teams/sessions-page';
import type { SessionsPageProps } from '@/components/teams/sessions-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function TeamSessions(props: SessionsPageProps) {
    const { t } = useTrans();
    const { workspace, team } = props;
    const params = { workspace: workspace.slug, team: team.id };

    return (
        <AppLayout
            active="sessions"
            breadcrumbs={[
                { title: team.name, href: TeamsController.show(params) },
                {
                    title: t('Sessions'),
                    href: TeamSessionsController.index(params),
                },
            ]}
        >
            <Head title={t('Sessions')} />
            <SessionsPage {...props} />
        </AppLayout>
    );
}
