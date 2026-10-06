import { router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import TeamEnpsController from '@/actions/App/Http/Controllers/TeamEnpsController';
import TeamHealthChecksController from '@/actions/App/Http/Controllers/TeamHealthChecksController';
import TeamInsightsController from '@/actions/App/Http/Controllers/TeamInsightsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import TeamSessionsController from '@/actions/App/Http/Controllers/TeamSessionsController';
import TeamSprintsController from '@/actions/App/Http/Controllers/TeamSprintsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import type { SessionCardProps } from '@/components/skrum/session-card';
import { LiveSessionBanner } from '@/components/teams/live-session-banner';
import { useNewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import { TeamActivityCard } from '@/components/teams/team-activity-card';
import { TeamCreateTiles } from '@/components/teams/team-create-tiles';
import type { CreateTileType } from '@/components/teams/team-create-tiles';
import { TeamHeader } from '@/components/teams/team-header';
import { TeamNewSessionDialog } from '@/components/teams/team-new-session-dialog';
import { TeamOpenActionsCard } from '@/components/teams/team-open-actions-card';
import { TeamPulseCard } from '@/components/teams/team-pulse-card';
import { TeamRecentSessions } from '@/components/teams/team-recent-sessions';
import { TeamScheduleLine } from '@/components/teams/team-schedule';
import { DeferredTrend } from '@/components/teams/trend-states';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLastDefined } from '@/hooks/use-last-defined';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItem } from '@/lib/retro/types';
import { activityHref } from '@/lib/teams/activity';
import type {
    NewSessionOptions,
    RecentSessionRow,
    RetroSummary,
    TeamActivityLine,
    TeamMember,
    TeamMoodPoint,
    TeamRole,
    TeamSchedule,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

export type TeamPageProps = NewSessionOptions & {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    members: Pick<TeamMember, 'id' | 'name' | 'avatarUrl'>[];
    /** The sessions in progress, the most recently active first. */
    liveNow: RecentSessionRow[];
    /** The five sessions most recently active that are not live. */
    recentSessions: RecentSessionRow[];
    /** False for a team with no session of any kind the viewer may see. */
    hasSessions: boolean;
    /** The first open action items of the team, overdue first. */
    openActionItems: ActionItem[];
    openActionItemCount: number;
    overdueActionItemCount: number;
    /** Deferred: absent while it loads, and still absent when the server could not build it. */
    moodTrend?: TeamMoodPoint[] | null;
    /** Deferred with the trend; null when no health check has results. */
    latestHealth?: { score: number; change: number | null } | null;
    /** Deferred with the trend: the team's last eNPS and its move, null when no survey counts. */
    latestEnps?: { score: number; change: number | null } | null;
    activity: TeamActivityLine[];
    /** The current sprint and the next retro; null when there is neither. */
    schedule: TeamSchedule | null;
    hasSprints: boolean;
    canManageRituals: boolean;
    /** The viewer's row in the team, for display; null for a manager outside it. */
    viewerRole: TeamRole | null;
    /** Whether the viewer only observes: never a workspace owner or admin, whatever their row says. */
    viewerIsObserver: boolean;
};

/** The regions of the page that can be replaced; a region left out is filled from the props. */
export type TeamPageSlots = {
    /** The sprint and the next retro, under the team name. */
    schedule?: ReactNode;
    openActions?: ReactNode;
    recentSessions?: ReactNode;
    activity?: ReactNode;
};

const OpenPhases = ['icebreaker', 'writing', 'grouping'];
const CompletedPhase = 'completed';

/**
 * The counts of a retro card (ScreenTeam): who joined and the cards while
 * the cards are written, the groups from the vote on, the action items once
 * the retro is closed.
 */
export function retroStatsFor(
    retro: Pick<RetroSummary, 'phase' | 'stats'>,
): SessionCardProps['stats'] {
    const { participants, cards, groups, actionItems } = retro.stats;

    if (retro.phase === CompletedPhase) {
        return { participants, cards, actions: actionItems };
    }

    if (OpenPhases.includes(retro.phase)) {
        return { participants, joined: true, cards };
    }

    return { participants, joined: true, cards, groups };
}

/** The slots the page fills from its own props; a slot given to the page replaces its default. */
function defaultSlots(
    props: TeamPageProps,
    openActionsTitle: string,
): TeamPageSlots {
    const { workspace, team } = props;
    const params = { workspace: workspace.slug, team: team.id };

    return {
        schedule: (
            <TeamScheduleLine
                schedule={props.schedule}
                startFirstSprintHref={
                    props.canManageRituals && !props.hasSprints
                        ? TeamSprintsController.index.url(params)
                        : undefined
                }
            />
        ),
        recentSessions: (
            <TeamRecentSessions
                rows={props.recentSessions}
                allSessionsHref={TeamSessionsController.index.url(params)}
            />
        ),
        openActions: (
            <TeamOpenActionsCard
                items={props.openActionItems}
                count={props.openActionItemCount}
                overdueCount={props.overdueActionItemCount}
                canCreate={!props.viewerIsObserver}
                seeAllHref={WorkspaceActionItemsController.index.url(
                    workspace.slug,
                    { query: { team: team.id } },
                )}
                title={openActionsTitle}
            />
        ),
        activity: (
            <TeamActivityCard
                lines={props.activity}
                allHref={activityHref(workspace.slug, team.id)}
            />
        ),
    };
}

/**
 * The team page asking for its New session dialog on a type
 * (`useNewSessionIntent`), for each type the viewer may create.
 */
function newSessionHrefs(
    props: TeamPageProps,
): Partial<Record<CreateTileType, string>> {
    if (props.viewerIsObserver) {
        return {};
    }

    const allowed: Record<CreateTileType, boolean> = {
        retro: props.canCreateRetro,
        poker: props.canCreatePokerGame,
        whiteboard: props.canCreateWhiteboard,
        survey: props.canCreateSurvey,
    };
    const params = { workspace: props.workspace.slug, team: props.team.id };

    return Object.fromEntries(
        (Object.keys(allowed) as CreateTileType[])
            .filter((type) => allowed[type])
            .map((type) => [
                type,
                TeamsController.show.url(params, { query: { new: type } }),
            ]),
    );
}

/** An old link to the settings card of the page leads where the Settings entry of the sidebar leads. */
function useSettingsAnchorRedirect(settingsHref: string | undefined): void {
    useEffect(() => {
        if (settingsHref === undefined) {
            return;
        }

        const follow = (): void => {
            if (window.location.hash === '#settings') {
                router.visit(settingsHref, { replace: true });
            }
        };

        follow();
        window.addEventListener('hashchange', follow);

        return () => window.removeEventListener('hashchange', follow);
    }, [settingsHref]);
}

export function TeamPage({
    slots: givenSlots = {},
    ...props
}: TeamPageProps & { slots?: TeamPageSlots }) {
    const { t } = useTrans();
    const newSessionIntent = useNewSessionIntent();
    const observingReasonId = useId();
    const { workspace, team } = props;
    const { currentTeam } = usePage().props;
    const slots = {
        ...defaultSlots(props, t('Needs attention')),
        ...givenSlots,
    };
    const settingsHref =
        currentTeam?.id === team.id
            ? (currentTeam.settingsUrl ?? undefined)
            : undefined;
    const observing = props.viewerIsObserver;
    const latestHealth = useLastDefined(props.latestHealth);
    const latestEnps = useLastDefined(props.latestEnps);
    const params = { workspace: workspace.slug, team: team.id };

    useSettingsAnchorRedirect(settingsHref);

    return (
        <div data-slot="team-page" className="flex min-w-0 flex-col gap-8">
            <TeamHeader
                workspace={workspace}
                team={team}
                members={props.members}
                schedule={slots.schedule}
                newSession={
                    observing ? (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                        <Button
                                            disabled
                                            aria-describedby={observingReasonId}
                                        >
                                            <Plus aria-hidden />
                                            <span className="truncate">
                                                {t('New session')}
                                            </span>
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {t('Observers cannot start sessions.')}
                                </TooltipContent>
                            </Tooltip>
                            <span id={observingReasonId} className="sr-only">
                                {t('Observers cannot start sessions.')}
                            </span>
                        </>
                    ) : (
                        <TeamNewSessionDialog
                            workspace={workspace}
                            team={team}
                            options={props}
                            intent={newSessionIntent}
                            trigger={
                                <Button>
                                    <Plus aria-hidden />
                                    <span className="truncate">
                                        {t('New session')}
                                    </span>
                                </Button>
                            }
                        />
                    )
                }
            />

            {props.hasSessions ? (
                <LiveSessionBanner
                    sessions={props.liveNow}
                    allSessionsHref={TeamSessionsController.index.url(params)}
                />
            ) : (
                <TeamCreateTiles hrefs={newSessionHrefs(props)} />
            )}

            <div
                data-slot="team-page-grid"
                className="grid min-w-0 gap-8 *:min-w-0 *:empty:hidden lg:grid-cols-2 lg:items-start"
            >
                <div className="lg:order-1">{slots.openActions}</div>
                {props.hasSessions && (
                    <div className="lg:order-3">{slots.recentSessions}</div>
                )}
                <div className="lg:order-2">
                    <DeferredTrend key={team.id} trend={props.moodTrend}>
                        {(state) => (
                            <TeamPulseCard
                                {...state}
                                health={latestHealth}
                                insightsHref={TeamInsightsController.show.url(
                                    params,
                                )}
                                healthHref={TeamHealthChecksController.show.url(
                                    params,
                                )}
                                enps={latestEnps}
                                enpsHref={TeamEnpsController.show.url(params)}
                            />
                        )}
                    </DeferredTrend>
                </div>
                <div className="lg:order-4">{slots.activity}</div>
            </div>
        </div>
    );
}
