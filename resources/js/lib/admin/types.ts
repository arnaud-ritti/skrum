export type AdminSection =
    | 'general'
    | 'branding'
    | 'signIn'
    | 'mail'
    | 'integrations'
    | 'mcpKeys'
    | 'licence'
    | 'users'
    | 'admins'
    | 'auditLog';

export type InstanceVersionState = 'unknown' | 'current' | 'outdated';

export type InstanceVersionStatus = {
    state: InstanceVersionState;
    latest: string | null;
    checkedAt: string | null;
};
