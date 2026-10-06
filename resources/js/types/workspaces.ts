import type { ColumnColor } from '@/lib/retro/types';
import type { WhiteboardPreview } from '@/types/poker';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type WorkspaceSummary = {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
};

export type SwitcherWorkspace = WorkspaceSummary & {
    teamsCount: number;
    role: WorkspaceRole;
};

export type CurrentWorkspace = WorkspaceSummary & {
    role: WorkspaceRole;
    /** From `WorkspacePolicy::manageMembers`: may invite and manage the members. */
    canManageMembers: boolean;
};

type WorkspaceTeamMember = {
    name: string;
    avatarUrl: string;
};

type WorkspaceTeamActivity = {
    /** Title of the newest retro that is not completed. */
    openRetroTitle: string | null;
    /** When the last completed retro ended. */
    lastRetroAt: string | null;
    openPokerGames: number;
    openActionItems: number;
    overdueActionItems: number;
    /** The number of the sprint the open retro was created in; null outside every sprint. */
    openRetroSprint: number | null;
    whiteboardsEditedToday: number;
};

export type WorkspaceTeamTile = TeamSummary & {
    color: ColumnColor;
    description: string | null;
    membersCount: number;
    members: WorkspaceTeamMember[];
    /** A manager sees every team; this is true for the ones they belong to. */
    isMember: boolean;
    activity: WorkspaceTeamActivity;
};

export type TeamSummary = {
    id: string;
    name: string;
    /** Sent where the team's mark or address is drawn: the team page, its tile and the onboarding. */
    color?: ColumnColor;
    slug?: string;
    /** The team's `/t/<slug>` address. */
    address?: string;
};

export type CurrentTeam = TeamSummary & {
    membersCount: number;
    /** The viewer's row in the team; null for a manager outside it. */
    viewerRole: TeamRole | null;
    /** The first tab of the team settings the viewer may open; null when none. */
    settingsUrl: string | null;
    /** The viewer may create a session of at least one kind in the team. */
    canCreateSession: boolean;
};

type MemberSummary = {
    id: string;
    name: string;
    email: string;
};

export type TeamRole = 'owner' | 'facilitator' | 'member' | 'observer';

export type TeamRoleOption = { value: TeamRole; label: string };

export type TeamMember = MemberSummary & {
    avatarUrl: string;
    role?: TeamRole;
};

export type Sprint = {
    id: string;
    number: number;
    startsOn: string;
    endsOn: string;
};

export type NextRetro = { date: string; time: string | null };

export type TeamSchedule = {
    sprint: Sprint | null;
    nextRetro: NextRetro | null;
};

export type TeamSprintRow = Sprint & { isCurrent: boolean };

export type NextSprintStart = {
    number: number;
    startsOn: string;
    endsOn: string;
    refusal: string | null;
};

export type TeamSprintsPanel = {
    list: TeamSprintRow[];
    total: number;
    current: Sprint | null;
    nextRetro: NextRetro | null;
    nextStart: NextSprintStart;
    timeZone: string;
};

export type TeamRituals = {
    sprintLengthWeeks: number | null;
    retroWeekday: number | null;
    retroTime: string | null;
};

export type FacilitatorOption = { id: string; name: string; avatarUrl: string };

/** A row of the members table of the Members page (`TeamMembersController::index`). */
export type TeamSettingsMember = MemberSummary & {
    avatarUrl: string;
    role: TeamRole;
    /** The latest session of the team they joined. */
    lastActiveAt: string | null;
    isViewer: boolean;
};

export type TeamFacilitatorsPanel = {
    list: FacilitatorOption[];
    rotation: boolean;
    suggested: { id: string; name: string } | null;
    /** The owners and facilitators of the team, who may be added. */
    candidates: FacilitatorOption[];
};

/** A template of the team with the team's own usage (`TeamTemplateUsage`). */
export type TeamTemplateUsageRow = {
    key: string;
    name: string;
    category: TemplateCategory | null;
    columns: TemplateColumn[];
    usageCount: number;
    isDefault: boolean;
    /** The workspace template behind a `workspace:` key. */
    templateId: string | null;
    canEdit: boolean;
};

export type TeamActivityKind =
    | 'retro_started'
    | 'retro_completed'
    | 'poker_started'
    | 'poker_ended'
    | 'whiteboard_created'
    | 'survey_published'
    | 'survey_closed'
    | 'action_item_completed'
    | 'member_joined';

export type TeamActivityLine = {
    id: string;
    kind: TeamActivityKind;
    actor: { name: string; avatarUrl: string | null };
    subject: { title: string; url: string | null } | null;
    at: string;
    /** The day of `at` in the application's time zone, `YYYY-MM-DD`. */
    day: string;
};

export type RecentSessionRow = {
    kind: 'retro' | 'poker' | 'whiteboard' | 'survey' | 'game';
    id: string;
    title: string;
    url: string;
    state: 'upcoming' | 'live' | 'finished';
    updatedAt: string;
    participants: number;
    meta: {
        phaseLabel?: string;
        cards?: number;
        tasks?: number;
        facilitatorName?: string | null;
        questions?: number;
        gameLabel?: string;
    };
    outcome: {
        kind: 'actions' | 'answers' | 'estimated';
        count: number;
    } | null;
};

export type TeamSettingsSections = {
    general: boolean;
    rituals: boolean;
    integrations: boolean;
    data: boolean;
    firstUrl: string | null;
};

export type TemplateVisibility = 'personal' | 'team' | 'workspace';

export type WorkspaceMember = MemberSummary & {
    avatarUrl: string;
    role: WorkspaceRole;
};

export type PendingInvitation = {
    id: string;
    email: string;
    role: WorkspaceRole;
    /** The team the invitation joins, when it names one. */
    team: { id: string; name: string } | null;
    teamRole: TeamRole | null;
    status: 'pending' | 'expired' | 'declined';
    isExpired: boolean;
    invitedAt: string;
};

export type RetroSummary = {
    id: string;
    title: string;
    phase: string;
    phaseLabel: string;
    createdAt: string | null;
    templateName: string;
    facilitator: { name: string; avatarUrl: string } | null;
    rotiAverage: number | null;
    /** The viewer is already a participant of this open retro. */
    viewerHasJoined: boolean;
    stats: RetroStats;
};

export type RetroStats = {
    participants: number;
    cards: number;
    groups: number;
    actionItems: number;
};

export type TemplateCategory =
    | 'essentials'
    | 'team_mood'
    | 'themed'
    | 'ideas'
    | 'analysis';

export type CategoryOption = { value: TemplateCategory; label: string };

export type TemplateColumn = {
    title: string;
    description: string | null;
    color: ColumnColor;
};

export type CatalogueTemplate = {
    key: string;
    name: string;
    category: TemplateCategory | null;
    isCommon: boolean;
    isWorkspace: boolean;
    columns: TemplateColumn[];
};

export type TemplateAuthor = {
    name: string;
    avatarUrl: string;
};

export type WorkspaceTemplateSummary = {
    id: string;
    name: string;
    category: TemplateCategory;
    author: TemplateAuthor | null;
    /** Retros created from this template, in every team of the workspace. */
    usageCount: number;
    visibility: TemplateVisibility;
    /** The team of a team template. */
    team: TeamSummary | null;
    /** The viewer may edit and delete it. */
    canManage: boolean;
    columns: TemplateColumn[];
};

export type WorkspaceWhiteboardTemplate = {
    id: string;
    name: string;
    description: string | null;
    preview: WhiteboardPreview;
    canManage: boolean;
};

export type WorkspacePokerDeck = {
    id: string;
    name: string;
    cards: string[];
    usageCount: number;
    author: TemplateAuthor | null;
    canManage: boolean;
};

export type TeamHealthStatement = {
    id: string;
    key: string;
    label: string;
    text: string;
    isBuiltin: boolean;
    isArchived: boolean;
};

/**
 * A point of the team's trend: a completed retro (its ROTI, and the mood of
 * the health check attached to it), or a health check run as a survey.
 */
export type TeamMoodPoint = {
    /** Null for a health check run as a survey. */
    retroId: string | null;
    /** The health check that gives the mood; null when there is none. */
    surveyId: string | null;
    title: string;
    completedAt: string;
    url: string;
    mood: number | null;
    /** The first and the third quartile of what each person gave; null with the mood. */
    moodQ1: number | null;
    moodQ3: number | null;
    moodVoters: number;
    roti: number | null;
    rotiVoters: number;
    /** "S35": the sprint the retro was created in; null outside every sprint. */
    sprintLabel?: string | null;
};
