import { Link } from '@inertiajs/react';
import { HeartPulse } from 'lucide-react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { TeamHealthManager } from '@/components/teams/team-health-manager';
import { TeamMoodCard } from '@/components/teams/team-mood-card';
import { DeferredTrend } from '@/components/teams/trend-states';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type {
    TeamHealthStatement,
    TeamMoodPoint,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

export type TeamHealthCheckPageProps = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    healthStatements: TeamHealthStatement[];
    canManageHealthStatements: boolean;
    /** Whether the viewer may start a health check (create a team survey). */
    canCreateSurvey: boolean;
    /** Deferred: absent while it loads, and still absent when the server could not build it. */
    moodTrend?: TeamMoodPoint[] | null;
};

/**
 * The health check of a team on a page of its own: the statements, managed by
 * who may, the mood they gave across the last health checks, and a way to
 * start one, through the "New session" dialog of the team page.
 */
export function TeamHealthCheckPage({
    workspace,
    team,
    healthStatements,
    canManageHealthStatements,
    canCreateSurvey,
    moodTrend,
}: TeamHealthCheckPageProps) {
    const { t } = useTrans();

    return (
        <div
            data-slot="team-health-check"
            className="flex min-w-0 flex-col gap-8"
        >
            <header className="flex min-w-0 flex-wrap items-start gap-x-5 gap-y-4">
                <div className="flex min-w-48 flex-1 flex-col gap-1">
                    <h1 className="font-display text-2xl font-bold tracking-heading wrap-anywhere">
                        {t('Health check')}
                    </h1>
                    <p className="text-body-sm text-muted-foreground">
                        {t(
                            'The statements :team scores from 1 to 10 in a retro, and the mood they give.',
                            { team: team.name },
                        )}
                    </p>
                </div>
                {canCreateSurvey && (
                    <Button asChild>
                        <Link
                            href={TeamsController.show(
                                { workspace: workspace.slug, team: team.id },
                                {
                                    query: {
                                        new: 'survey',
                                        template: 'health_check',
                                    },
                                },
                            )}
                        >
                            <HeartPulse aria-hidden />
                            <span className="truncate">
                                {t('Start a health check')}
                            </span>
                        </Link>
                    </Button>
                )}
            </header>
            <div className="grid min-w-0 gap-8 xl:grid-cols-2 xl:items-start">
                <div className="min-w-0">
                    <TeamHealthManager
                        workspaceSlug={workspace.slug}
                        teamId={team.id}
                        statements={healthStatements}
                        canManage={canManageHealthStatements}
                    />
                </div>
                <div className="min-w-0">
                    <DeferredTrend key={team.id} trend={moodTrend}>
                        {(state) => <TeamMoodCard {...state} />}
                    </DeferredTrend>
                </div>
            </div>
        </div>
    );
}
