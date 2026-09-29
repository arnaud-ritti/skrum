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

export type TemplateOption = {
    value: string;
    label: string;
};
