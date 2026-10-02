import type { ColumnColor } from '@/lib/retro/types';
import type { WhiteboardPreview } from '@/types/poker';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type WorkspaceSummary = {
    id: string;
    name: string;
    slug: string;
};

export type CurrentWorkspace = WorkspaceSummary & {
    role: WorkspaceRole;
};

export type TeamSummary = {
    id: string;
    name: string;
};

export type CurrentTeam = TeamSummary & {
    membersCount: number;
};

export type MemberSummary = {
    id: string;
    name: string;
    email: string;
};

export type WorkspaceMember = MemberSummary & {
    role: WorkspaceRole;
};

export type PendingInvitation = {
    id: string;
    email: string;
    role: WorkspaceRole;
    isExpired: boolean;
};

export type RetroSummary = {
    id: string;
    title: string;
    phase: string;
    phaseLabel: string;
    createdAt: string;
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

export type WorkspaceTemplateSummary = {
    id: string;
    name: string;
    category: TemplateCategory;
    author: string | null;
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
