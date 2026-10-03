import type { TeamRole } from '@/types';

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
