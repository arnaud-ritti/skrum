export type User = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    single_key_shortcuts?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
};

export type Passkey = {
    id: string;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};

export type SsoProviderKey = 'google' | 'github' | 'entra' | 'oidc';

export type SsoProviderOption = {
    key: SsoProviderKey;
    label: string;
};

export type SecondFactorMethod = 'totp' | 'email';

/** The e-mail code at the challenge; `sentTo` is the masked address. */
export type EmailCodeChallengeState = {
    sentTo: string;
    resendIn: number;
    available: boolean;
};

/** The e-mail code in the security settings. */
export type EmailSecondFactor = {
    /** Mail delivers on this instance. */
    available: boolean;
    enabled: boolean;
    address: string;
    resendIn: number;
};

export type TwoFactorSummary = {
    confirmedAt: string | null;
    recoveryCodesRemaining: number | null;
    recoveryCodesTotal: number;
};
