import { Head } from '@inertiajs/react';
import { InsightsTabs, RetroRotiList } from '@/components/teams/insights-tabs';
import type { RetroRoti } from '@/components/teams/insights-tabs';
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
    retros: RetroRoti[];
};

export default function TeamInsights({
    workspace,
    team,
    moodTrend,
    retros,
}: Props) {
    const { t } = useTrans();

    return (
        <AppLayout active="insights" title={t('Insights')}>
            <Head title={`${t('Mood & ROTI')} · ${team.name}`} />
            <InsightsTabs workspace={workspace} team={team} active="mood" />
            <div className="flex min-w-0 flex-col gap-8">
                <DeferredTrend key={team.id} trend={moodTrend}>
                    {(state) => <TeamRotiCard {...state} />}
                </DeferredTrend>
                <RetroRotiList retros={retros} />
            </div>
        </AppLayout>
    );
}
