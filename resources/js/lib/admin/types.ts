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

export type InstanceVersionState =
    | 'unknown'
    | 'unreleased'
    | 'current'
    | 'outdated';

export type InstanceVersionStatus = {
    state: InstanceVersionState;
    latest: string | null;
    checkedAt: string | null;
    /** The notes of the latest release, while the instance is behind it. */
    releaseUrl: string | null;
};

export type SignupMode = 'invite' | 'open' | 'domain';

export type GeneralSettingsPageProps = {
    /** Stored here; null follows the environment. */
    signupMode: SignupMode | null;
    allowedEmailDomains: string[] | null;
    defaults: { signupMode: SignupMode; allowedEmailDomains: string[] };
    updateCheckEnabled: boolean;
    version: string;
    versionStatus: InstanceVersionStatus;
    /** The published image, named in the update procedure. */
    image: string;
};

export type ConfigurationFieldSource = 'stored' | 'environment' | 'none';

export type ConfigurationValue = string | number | boolean | string[] | null;

/** One field of a configuration section, as the server describes it: never a secret's value (rule S5). */
export type ConfigurationFieldDescription = {
    /** Null for a secret. */
    value: ConfigurationValue;
    source: ConfigurationFieldSource;
    secret: boolean;
    secretSet: boolean;
    /** A stored secret that can no longer be decrypted (rule S7). */
    unreadable: boolean;
    envName: string;
};

export type ConfigurationFields = Record<string, ConfigurationFieldDescription>;

export type SsoProviderKey = 'google' | 'github' | 'entra' | 'oidc';

export type SsoProviderDetails = {
    key: SsoProviderKey;
    label: string;
    configured: boolean;
    redirectUri: string;
    fields: ConfigurationFields;
    testable: boolean;
    updateUrl: string;
    /** When the stored secret last changed, from the audit log; null for an environment or cleared secret. */
    secretChangedAt: string | null;
};

export type SsoTestError = 'unreachable' | 'not_oidc' | 'issuer_mismatch';

export type SsoTestResult = {
    ok: boolean;
    ms: number | null;
    issuer: string | null;
    error: SsoTestError | null;
};

export type SsoLastTest = {
    provider: SsoProviderKey;
    at: string;
    ok: boolean;
    ms: number | null;
    issuer: string | null;
};

/** Why the last test e-mail failed: a code, never the server's own answer. */
export type MailTestError = 'transport' | 'log' | 'unknown';

export type MailLastTest = {
    at: string;
    ok: boolean;
    to: string;
    error?: MailTestError | null;
};

export type MailSettings = {
    /** The mailer in force sends mails (it does not write them to the log). */
    delivering: boolean;
    fields: ConfigurationFields;
};

export type MailSettingsPageProps = {
    mail: MailSettings;
    lastTest: MailLastTest | null;
    defaultRecipient: string;
    /** End of the fresh password confirmation that configuration writes need (rule S2). */
    confirmedUntil: string | null;
    confirmUrl: string;
    updateUrl: string;
};

export type IntegrationProviderKey =
    | 'slack'
    | 'telegram'
    | 'jira'
    | 'linear'
    | 'jira_dc'
    | 'github'
    | 'msteams'
    | 'mattermost'
    | 'webhook';

/** One integration provider at instance level: never a secret's value (rule S5). */
export type IntegrationProviderSettings = {
    key: IntegrationProviderKey;
    label: string;
    configured: boolean;
    /** Configured and not turned off here. */
    enabled: boolean;
    connectedTeams: number;
    fields: ConfigurationFields;
    callbackUrl: string | null;
    webhookUrl: string | null;
    updateUrl: string;
};

export type IntegrationSettingsPageProps = {
    providers: IntegrationProviderSettings[];
    /** The providers turned off here, configured or not. */
    disabled: string[];
    /** End of the fresh password confirmation that configuration writes need (rule S2). */
    confirmedUntil: string | null;
    confirmUrl: string;
};

/** An MCP key of any user, as the admin sees it: the fingerprint, never the secret. */
export type McpKey = {
    id: string;
    name: string;
    owner: { id: string; name: string; avatarUrl: string };
    /** The token prefix and the last four characters. */
    fingerprint: string;
    scopes: string[];
    /** Null for a key valid on every team of its owner. */
    team: string | null;
    createdAt: string | null;
    lastUsedAt: string | null;
    expiresAt: string | null;
};

/** One page of the keys, as Laravel's paginator serialises it. */
export type McpKeysPage = {
    data: McpKey[];
    current_page: number;
    last_page: number;
    total: number;
};

export type McpKeysPageProps = {
    keys: McpKeysPage;
    /** `SKRUM_MCP_ENABLED`: the list is shown either way. */
    mcpEnabled: boolean;
    /** The admin's own token settings, where a key is created. */
    createUrl: string;
};

/** An account of the instance, as the admin's Users section lists it. */
export type AdminUser = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    isAdmin: boolean;
    isDeactivated: boolean;
    hasSecondFactor: boolean;
    workspacesCount: number;
    createdAt: string | null;
    /** Null until the account signs in again after the column was added. */
    lastSignedInAt: string | null;
    isSelf: boolean;
};

export type AdminUsersStatus = 'all' | 'active' | 'deactivated' | 'admins';

export type AdminUsersFilters = {
    query: string | null;
    status: AdminUsersStatus;
};

/** One page of the accounts, as Laravel's paginator serialises it. */
export type AdminUsersPage = {
    data: AdminUser[];
    current_page: number;
    last_page: number;
    total: number;
};

export type UsersPageProps = {
    users: AdminUsersPage;
    filters: AdminUsersFilters;
    activeAdminCount: number;
};

export type LicencePageProps = {
    /** The project's licence, never the deployer's: `AGPL-3.0-or-later`. */
    licence: string;
    licenceUrl: string;
    repositoryUrl: string;
    /** The accounts not deactivated. */
    accountsInUse: number;
    version: string;
};

/** Every value of `App\Enums\AuditAction`, in its order. */
export const AuditActions = [
    'settings_updated',
    'configuration_updated',
    'branding_reset',
    'sso_tested',
    'mail_tested',
    'sso_required_changed',
    'admin_granted',
    'admin_revoked',
    'user_deactivated',
    'user_reactivated',
    'signed_in',
    'sign_in_failed',
    'two_factor_enabled',
    'two_factor_disabled',
    'password_changed',
    'token_created',
    'token_revoked',
    'token_revoked_by_admin',
] as const;

export type AuditAction = (typeof AuditActions)[number];

export const AuditGroups = [
    'settings',
    'accounts',
    'signIn',
    'tokens',
] as const;

export type AuditGroup = (typeof AuditGroups)[number];

/** One event of the audit log: names and identifiers, never a secret or a configuration value. */
export type AuditEvent = {
    id: string;
    action: AuditAction;
    group: AuditGroup;
    /** Null for the system; a null id for an actor whose account is gone. */
    actor: { id: string | null; name: string; avatarUrl: string | null } | null;
    subject: { type: string; id: string | null; label: string | null } | null;
    properties: Record<string, unknown>;
    /** The owner of a key an admin revoked. */
    ownerName: string | null;
    ip: string | null;
    at: string;
};

/** One page of the events, as Laravel's paginator serialises it. */
export type AuditEventsPage = {
    data: AuditEvent[];
    current_page: number;
    last_page: number;
    total: number;
};

export type AuditLogFilters = {
    group: AuditGroup | null;
    actor: string | null;
};

export type AuditLogPageProps = {
    events: AuditEventsPage;
    filters: AuditLogFilters;
    retentionDays: number;
};
