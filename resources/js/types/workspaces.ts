export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type WorkspaceSummary = {
    id: string;
    name: string;
    slug: string;
};

export type CurrentWorkspace = WorkspaceSummary & {
    role: WorkspaceRole;
};
