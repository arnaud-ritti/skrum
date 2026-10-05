import { Head } from '@inertiajs/react';
import TeamInsightsController from '@/actions/App/Http/Controllers/TeamInsightsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import { TeamRotiCard } from '@/components/teams/team-roti-card';
import { DeferredTrend } from '@/components/teams/trend-states';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import type { TeamMoodPoint, TeamSummary, WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    /** Deferred: absent while it loads, and still absent when the server could not build it. */
    moodTrend?: TeamMoodPoint[] | null;
    /** The completed retros that have a ROTI, newest first. */
    retros: {
        id: string;
        title: string;
        url: string;
        roti: number;
        closedOn: string;
    }[];
};

export default function TeamInsights({ workspace, team, moodTrend }: Props) {
    const { t } = useTrans();
    const workspaceHref = WorkspacesController.show(workspace.slug);
    const scope = { workspace: workspace.slug, team: team.id };

    return (
        <AppLayout
            active="mood"
            breadcrumbs={[
                { title: workspace.name, href: workspaceHref },
                { title: t('Teams'), href: workspaceHref },
                { title: team.name, href: TeamsController.show(scope) },
                {
                    title: t('Mood & ROTI'),
                    href: TeamInsightsController.show(scope),
                },
            ]}
        >
            <Head title={`${t('Mood & ROTI')} · ${team.name}`} />
            <DeferredTrend key={team.id} trend={moodTrend}>
                {(state) => <TeamRotiCard {...state} />}
            </DeferredTrend>
        </AppLayout>
    );
}
