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
    /** When the stored secret last changed, from the audit log (Task 37). */
    secretChangedAt?: string | null;
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
export type MailTestError = 'transport' | 'unknown';

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
