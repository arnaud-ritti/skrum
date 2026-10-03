import type { ColumnColor } from '@/lib/retro/types';
import type { WhiteboardPreview } from '@/types/poker';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type WorkspaceSummary = {
    id: string;
    name: string;
    slug: string;
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
};

export type WorkspaceTeamTile = TeamSummary & {
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
};

type MemberSummary = {
    id: string;
    name: string;
    email: string;
};

export type TeamMember = MemberSummary & {
    avatarUrl: string;
};

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
