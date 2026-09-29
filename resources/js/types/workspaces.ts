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
