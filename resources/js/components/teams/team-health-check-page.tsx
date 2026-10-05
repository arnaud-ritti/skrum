import { Link } from '@inertiajs/react';
import { HeartPulse, Pencil } from 'lucide-react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { TeamMoodCard } from '@/components/teams/team-mood-card';
import { DeferredTrend } from '@/components/teams/trend-states';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { TeamMoodPoint, TeamSummary, WorkspaceSummary } from '@/types';

export type TeamHealthCheckPageProps = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    /** Whether the viewer may edit the statements, which are on the rituals page. */
    canEditStatements: boolean;
    ritualsUrl: string;
    /** Whether the viewer may start a health check (create a team survey). */
    canCreateSurvey: boolean;
    /** Deferred: absent while it loads, and still absent when the server could not build it. */
    moodTrend?: TeamMoodPoint[] | null;
};

/**
 * The health check tab of Insights: the mood the statements gave across the
 * last health checks, a way to start one through the "New session" dialog of
 * the team page, and the way to the statements for who may edit them.
 */
export function TeamHealthCheckPage({
    workspace,
    team,
    canEditStatements,
    ritualsUrl,
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
                    <h2 className="font-display text-xl font-bold tracking-heading wrap-anywhere">
                        {t('Health check')}
                    </h2>
                    <p className="text-body-sm text-muted-foreground">
                        {t(
                            'The statements :team scores from 1 to 5 in every health check, and the mood they give.',
                            { team: team.name },
                        )}
                    </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {canEditStatements && (
                        <Button variant="outline" asChild>
                            <Link href={ritualsUrl}>
                                <Pencil aria-hidden />
                                <span className="truncate">
                                    {t('Edit the statements')}
                                </span>
                            </Link>
                        </Button>
                    )}
                    {canCreateSurvey && (
                        <Button asChild>
                            <Link
                                href={TeamsController.show(
                                    {
                                        workspace: workspace.slug,
                                        team: team.id,
                                    },
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
                </div>
            </header>
            <DeferredTrend key={team.id} trend={moodTrend}>
                {(state) => <TeamMoodCard {...state} />}
            </DeferredTrend>
        </div>
    );
}
