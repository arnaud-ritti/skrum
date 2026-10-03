import type { TeamRole, WorkspaceRole } from '@/types';

type Translate = (key: string) => string;

export const teamRoles: TeamRole[] = [
    'owner',
    'facilitator',
    'member',
    'observer',
];

export function teamRoleLabel(role: TeamRole, t: Translate): string {
    switch (role) {
        case 'owner':
            return t('Owner');
        case 'facilitator':
            return t('Facilitator');
        case 'member':
            return t('Member');
        case 'observer':
            return t('Observer');
    }
}

/** Everyone takes part in the team's sessions but an observer; a manager outside the team has no role and takes part. */
export function takesPart(role: TeamRole | null | undefined): boolean {
    return role !== 'observer';
}

export function managesRituals(role: TeamRole | null | undefined): boolean {
    return role === 'owner' || role === 'facilitator';
}

export function workspaceRoleLabel(role: WorkspaceRole, t: Translate): string {
    switch (role) {
        case 'owner':
            return t('Owner');
        case 'admin':
            return t('Admin');
        case 'member':
            return t('Member');
    }
}

/** The second line of the sidebar user card: "Facilitator · Admin", the workspace role alone outside the team. */
export function userCardRole(
    teamRole: TeamRole | null,
    workspaceRole: WorkspaceRole,
    t: Translate,
): string {
    const workspace = workspaceRoleLabel(workspaceRole, t);

    if (teamRole === null) {
        return workspace;
    }

    return `${teamRoleLabel(teamRole, t)} · ${workspace}`;
}
