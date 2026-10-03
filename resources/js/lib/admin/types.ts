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

export type SignupMode = 'invite' | 'open' | 'domain';

export type GeneralSettingsPageProps = {
    /** Stored here; null follows the environment. */
    signupMode: SignupMode | null;
    allowedEmailDomains: string[] | null;
    defaults: { signupMode: SignupMode; allowedEmailDomains: string[] };
    maintenanceMessage: string | null;
    maintenanceMessageBy: { name: string } | null;
    maintenanceMessageAt: string | null;
    updateCheckEnabled: boolean;
    version: string;
    versionStatus: InstanceVersionStatus;
};
