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
};

export type CurrentTeam = TeamSummary & {
    membersCount: number;
    /** The viewer's row in the team; null for a manager outside it. */
    viewerRole: TeamRole | null;
    /** The first tab of the team settings the viewer may open; null when none. */
    settingsUrl: string | null;
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
};

export type TeamRituals = {
    sprintLengthWeeks: number | null;
    retroWeekday: number | null;
    retroTime: string | null;
};

export type FacilitatorOption = { id: string; name: string; avatarUrl: string };

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
    members: boolean;
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
    isExpired: boolean;
    invitedAt: string;
};

export type RetroSummary = {
    id: string;
    title: string;
    phase: string;
    phaseLabel: string;
    createdAt: string;
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

export type LlmAvailability = {
    enabled: boolean;
    provider: string | null;
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
    moodVoters: number;
    roti: number | null;
    rotiVoters: number;
};
