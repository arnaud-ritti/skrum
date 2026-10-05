import { router, usePage } from '@inertiajs/react';
import { Plus, UserPlus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import TeamSessionsController from '@/actions/App/Http/Controllers/TeamSessionsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import { TeamInviteDialog } from '@/components/invitations/team-invite-dialog';
import type { SessionCardProps } from '@/components/skrum/session-card';
import { useNewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import { TeamHeader } from '@/components/teams/team-header';
import { TeamHealthCard } from '@/components/teams/team-health-card';
import { TeamMembersCard } from '@/components/teams/team-members-card';
import { TeamNewSessionDialog } from '@/components/teams/team-new-session-dialog';
import { TeamActivityCard } from '@/components/teams/team-activity-card';
import { TeamOpenActionsCard } from '@/components/teams/team-open-actions-card';
import { TeamPokerSection } from '@/components/teams/team-poker-section';
import { TeamRecentSessions } from '@/components/teams/team-recent-sessions';
import { TeamRetrosSection } from '@/components/teams/team-retros-section';
import { TeamRoleBadge } from '@/components/teams/team-role-badge';
import { TeamRotiCard } from '@/components/teams/team-roti-card';
import { TeamScheduleLine } from '@/components/teams/team-schedule';
import { TeamSurveysSection } from '@/components/teams/team-surveys-section';
import { TeamWhiteboardsSection } from '@/components/teams/team-whiteboards-section';
import { LiveSessionBanner } from '@/components/teams/live-session-banner';
import { DeferredTrend } from '@/components/teams/trend-states';
import { WhiteboardThumbnail } from '@/components/teams/whiteboard-thumbnail';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type {
    InviteLink,
    LiveSessionFlash,
    PendingInvitation,
    TeamRoleValue,
} from '@/lib/invitations/types';
import type { ActionItem } from '@/lib/retro/types';
import type {
    NewSessionOptions,
    PokerGameSummary,
    RecentSessionRow,
    RetroSummary,
    TeamActivityLine,
    TeamHealthStatement,
    TeamMember,
    TeamMoodPoint,
    TeamRole,
    TeamRoleOption,
    TeamSchedule,
    TeamSummary,
    WhiteboardSummary,
    WhiteboardTemplateSummary,
    WorkspaceSummary,
} from '@/types';

export type TeamPageProps = NewSessionOptions & {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    members: TeamMember[];
    availableMembers: TeamMember[];
    canManage: boolean;
    openActionItemCount: number;
    retros: RetroSummary[];
    healthStatements: TeamHealthStatement[];
    canManageHealthStatements: boolean;
    pokerGames: PokerGameSummary[];
    canManageIntegrations: boolean;
    whiteboards: WhiteboardSummary[];
    whiteboardTemplates: WhiteboardTemplateSummary[];
    /** Deferred: absent while it loads, and still absent when the server could not build it. */
    moodTrend?: TeamMoodPoint[] | null;
    pokerPresence?: Record<string, number | null> | null;
    /** The roles a member can be given; empty for who cannot manage the members. */
    roleOptions: TeamRoleOption[];
    /** The viewer's row in the team, for display; null for a manager outside it. */
    viewerRole: TeamRole | null;
    /** Whether the viewer only observes: never a workspace owner or admin, whatever their row says. */
    viewerIsObserver: boolean;
    canManageRituals: boolean;
    /** The current sprint and the next retro; null when there is neither. */
    schedule: TeamSchedule | null;
    hasSprints: boolean;
    activity: TeamActivityLine[];
    recentSessions: RecentSessionRow[];
    /** The first open action items of the team, overdue first. */
    openActionItems: ActionItem[];
    overdueActionItemCount: number;
    /** The team's inviters: who manages its members, and its facilitators (decision 2 B). */
    canInvite: boolean;
    inviteRoles: TeamRoleValue[];
    /** Optional: loaded when the invite dialog opens; null when the team has no usable link. */
    inviteLink?: InviteLink | null;
    /** The team's invitations not accepted yet; empty unless `canInvite`. */
    pendingInvitations: PendingInvitation[];
};

/**
 * Places left for the features that come after the rewrite. Each is a region
 * of the page; nothing is rendered while its slot is undefined.
 */
export type TeamPageSlots = {
    /** TM-1: sprint and next retro, under the team name. */
    schedule?: ReactNode;
    /** TM-2: the recent sessions table, first block of the main column. */
    recentSessions?: ReactNode;
    /** TM-3: the aggregated open actions, under the recent sessions. */
    openActions?: ReactNode;
    /** TM-4: the activity feed, last block of the main column. */
    activity?: ReactNode;
    /** IN-4: "Invite", in the header of the members card. */
    inviteAction?: ReactNode;
    /** TM-6: the role badge of a member. */
    roleBadgeFor?: (member: TeamMember) => ReactNode;
    /** TM-5: participants, cards and actions of a retro card. */
    retroStatsFor?: Parameters<typeof TeamRetrosSection>[0]['statsFor'];
    /** TM-7: the thumbnail of a whiteboard. */
    whiteboardThumbnailFor?: (board: WhiteboardSummary) => ReactNode;
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
function defaultSlots(props: TeamPageProps): TeamPageSlots {
    const { workspace, team } = props;
    const params = { workspace: workspace.slug, team: team.id };

    return {
        schedule: (
            <TeamScheduleLine
                schedule={props.schedule}
                startFirstSprintHref={
                    props.canManageRituals && !props.hasSprints
                        ? `${TeamMembersController.index.url(params)}#sprints`
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
            />
        ),
        activity: <TeamActivityCard lines={props.activity} />,
        roleBadgeFor: (member) => <TeamRoleBadge role={member.role} />,
        retroStatsFor,
        whiteboardThumbnailFor: (board) => (
            <WhiteboardThumbnail preview={board.preview} />
        ),
    };
}

/**
 * P25-10: the session in progress flashed right after landing on the team.
 * Kept once received, so that a partial reload (the invite dialog's) does
 * not drop it; it belongs to the team it was flashed on.
 */
function useLiveSession(teamId: string): [LiveSessionFlash | null, () => void] {
    const flashed = usePage().flash.liveSession;
    const [kept, setKept] = useState<{
        teamId: string;
        session: LiveSessionFlash;
    } | null>(() =>
        flashed === undefined ? null : { teamId, session: flashed },
    );

    useEffect(() => {
        if (flashed !== undefined) {
            setKept({ teamId, session: flashed });
        }
    }, [flashed, teamId]);

    const session = kept?.teamId === teamId ? kept.session : null;

    return [session, () => setKept(null)];
}

/** An old link to the settings card of the page leads where the gear leads. */
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
    const slots = { ...defaultSlots(props), ...givenSlots };
    const settingsHref =
        currentTeam?.id === team.id
            ? (currentTeam.settingsUrl ?? undefined)
            : undefined;
    const observing = props.viewerIsObserver;
    const [inviting, setInviting] = useState(false);
    const [liveSession, dismissLiveSession] = useLiveSession(team.id);
    const inviteAction =
        slots.inviteAction ??
        (props.canInvite ? (
            <Button variant="ghost" size="sm" onClick={() => setInviting(true)}>
                <UserPlus aria-hidden />
                <span>{t('Invite')}</span>
            </Button>
        ) : undefined);

    useSettingsAnchorRedirect(settingsHref);

    return (
        <div data-slot="team-page" className="flex min-w-0 flex-col gap-8">
            {liveSession !== null && (
                <LiveSessionBanner
                    session={liveSession}
                    onDismiss={dismissLiveSession}
                />
            )}
            <TeamHeader
                workspace={workspace}
                team={team}
                members={props.members}
                openActionItemCount={props.openActionItemCount}
                settingsHref={settingsHref}
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

            <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_22.5rem] xl:items-start">
                <div className="flex min-w-0 flex-col gap-8">
                    <div
                        id="sessions"
                        className="flex min-w-0 scroll-mt-20 flex-col gap-8"
                    >
                        {slots.recentSessions}
                        {slots.openActions}
                        <TeamRetrosSection
                            retros={props.retros}
                            statsFor={slots.retroStatsFor}
                        />
                        <TeamPokerSection
                            key={team.id}
                            workspaceSlug={workspace.slug}
                            teamId={team.id}
                            games={props.pokerGames}
                            presence={props.pokerPresence}
                        />
                        <TeamWhiteboardsSection
                            workspaceSlug={workspace.slug}
                            boards={props.whiteboards}
                            templates={props.whiteboardTemplates}
                            thumbnailFor={slots.whiteboardThumbnailFor}
                        />
                        <TeamSurveysSection
                            workspaceSlug={workspace.slug}
                            teamId={team.id}
                            surveys={props.surveys}
                            canCreateSurvey={props.canCreateSurvey}
                        />
                    </div>
                    <div id="mood" className="min-w-0 scroll-mt-20">
                        <DeferredTrend key={team.id} trend={props.moodTrend}>
                            {(state) => <TeamRotiCard {...state} />}
                        </DeferredTrend>
                    </div>
                    {slots.activity}
                </div>

                <aside className="flex min-w-0 flex-col gap-8">
                    <TeamHealthCard
                        workspaceSlug={workspace.slug}
                        teamId={team.id}
                        statements={props.healthStatements}
                        canManage={props.canManageHealthStatements}
                    />
                    <div id="members" className="min-w-0 scroll-mt-20">
                        <TeamMembersCard
                            workspaceSlug={workspace.slug}
                            team={team}
                            members={props.members}
                            availableMembers={props.availableMembers}
                            canManage={props.canManage}
                            roleOptions={props.roleOptions}
                            inviteAction={inviteAction}
                            roleBadgeFor={slots.roleBadgeFor}
                        />
                    </div>
                </aside>
            </div>
            {props.canInvite && (
                <TeamInviteDialog
                    workspaceSlug={workspace.slug}
                    team={team}
                    roles={props.inviteRoles}
                    inviteLink={props.inviteLink}
                    open={inviting}
                    onOpenChange={setInviting}
                />
            )}
        </div>
    );
}
