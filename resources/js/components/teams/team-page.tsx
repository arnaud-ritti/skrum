import { usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import { TeamHeader } from '@/components/teams/team-header';
import { TeamHealthCard } from '@/components/teams/team-health-card';
import { TeamMembersCard } from '@/components/teams/team-members-card';
import { TeamNewSessionDialog } from '@/components/teams/team-new-session-dialog';
import { TeamPokerSection } from '@/components/teams/team-poker-section';
import { TeamRetrosSection } from '@/components/teams/team-retros-section';
import { TeamRotiCard } from '@/components/teams/team-roti-card';
import { TeamSettingsCard } from '@/components/teams/team-settings-card';
import { TeamSurveysSection } from '@/components/teams/team-surveys-section';
import { TeamWhiteboardsSection } from '@/components/teams/team-whiteboards-section';
import { DeferredTrend } from '@/components/teams/trend-states';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { teamSettingsHref } from '@/lib/teams/settings-href';
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
    /** The viewer's row in the team; null for a manager outside it. */
    viewerRole: TeamRole | null;
    canManageRituals: boolean;
    /** The current sprint and the next retro; null when there is neither. */
    schedule: TeamSchedule | null;
    hasSprints: boolean;
    activity: TeamActivityLine[];
    recentSessions: RecentSessionRow[];
    /** The first open action items of the team, overdue first. */
    openActionItems: ActionItem[];
    overdueActionItemCount: number;
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
    /** TM-3: the aggregated open actions, first block of the side column. */
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

export function TeamPage({
    slots = {},
    ...props
}: TeamPageProps & { slots?: TeamPageSlots }) {
    const { t } = useTrans();
    const newSessionIntent = useNewSessionIntent();
    const { workspace, team } = props;
    const { currentTeam } = usePage().props;

    return (
        <div data-slot="team-page" className="flex min-w-0 flex-col gap-8">
            <TeamHeader
                workspace={workspace}
                team={team}
                members={props.members}
                openActionItemCount={props.openActionItemCount}
                settingsHref={
                    currentTeam?.id === team.id
                        ? teamSettingsHref(currentTeam)
                        : undefined
                }
                schedule={slots.schedule}
                newSession={
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
                }
            />

            <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_22.5rem] xl:items-start">
                <div className="flex min-w-0 flex-col gap-8">
                    <div
                        id="sessions"
                        className="flex min-w-0 scroll-mt-20 flex-col gap-8"
                    >
                        {slots.recentSessions}
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
                    {slots.openActions}
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
                            inviteAction={slots.inviteAction}
                            roleBadgeFor={slots.roleBadgeFor}
                        />
                    </div>
                    {props.canManage && (
                        <div id="settings" className="min-w-0 scroll-mt-20">
                            <TeamSettingsCard
                                workspaceSlug={workspace.slug}
                                team={team}
                            />
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
