import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { CreateTokenForm } from '@/components/settings/api-tokens/create-token-form';
import { ServerUrl } from '@/components/settings/api-tokens/server-url';
import { TokenList } from '@/components/settings/api-tokens/token-list';
import { AppearanceCard } from '@/components/settings/appearance/appearance-card';
import { ShortcutPreferenceCard } from '@/components/settings/appearance/shortcut-preference-card';
import { AvatarStyleCard } from '@/components/settings/avatar-style-card';
import type { ProfileAvatarStyle } from '@/components/settings/avatar-style-card';
import { DeleteAccountCard } from '@/components/settings/delete-account-card';
import { LockedSettingsCard } from '@/components/settings/locked-settings-card';
import { NotificationsCard } from '@/components/settings/notifications-card';
import type { NotificationPreferences } from '@/components/settings/notifications-card';
import { ProfileCard } from '@/components/settings/profile-card';
import { PasskeysCard } from '@/components/settings/security/passkeys-card';
import { PasswordCard } from '@/components/settings/security/password-card';
import { PasswordBreachCheck } from '@/components/settings/security/password-strength';
import { SecurityStack } from '@/components/settings/security/security-stack';
import { TwoFactorCard } from '@/components/settings/security/two-factor-card';
import {
    SettingsSection,
    SettingsSections,
    SettingsShell,
} from '@/components/settings/settings-shell';
import type { SettingsSectionId } from '@/components/settings/settings-shell';
import { useVisibleSection } from '@/components/settings/use-visible-section';
import { useTrans } from '@/hooks/use-trans';
import { index as unlockApiTokens } from '@/routes/apiTokens';
import { edit as unlockSecurity } from '@/routes/security';
import type {
    ApiToken,
    ApiTokenExpiration,
    ApiTokenExpirationOption,
    ApiTokenTeamGroup,
    Auth,
    NewApiToken,
} from '@/types';
import type {
    EmailSecondFactor,
    Passkey,
    TwoFactorSummary,
} from '@/types/auth';

export type ProfileSettings = {
    mustVerifyEmail: boolean;
    status?: string | null;
    avatarMemberChoice: boolean;
    avatarStyle: string | null;
    instanceAvatarStyle: string;
    avatarStyles: ProfileAvatarStyle[];
};

/** What the security section says about the account: sent only behind a confirmed password. */
export type ProtectedSecuritySettings = {
    twoFactorEnabled: boolean;
    twoFactor: TwoFactorSummary;
    passkeys: Passkey[];
    emailSecondFactor: EmailSecondFactor;
};

export type SecuritySettings = {
    passwordRules: string;
    /** The server refuses a password found in known data breaches. */
    checksCompromisedPasswords: boolean;
    canManageTwoFactor: boolean;
    canManagePasskeys: boolean;
    requiresConfirmation: boolean;
    /** There is something behind the lock: a second factor or passkeys to manage. */
    hasProtectedSettings: boolean;
    locked: boolean;
    protected: ProtectedSecuritySettings | null;
};

export type NotificationSettings = {
    preferences: NotificationPreferences;
    reminderTime: string;
    remindersEnabled: boolean;
};

/** The whole API token section is sent only behind a confirmed password. */
export type ProtectedApiTokenSettings = {
    tokens: ApiToken[];
    teamGroups: ApiTokenTeamGroup[];
    mcpUrl: string;
    expirationOptions: ApiTokenExpirationOption[];
    defaultExpiration: ApiTokenExpiration;
};

export type ApiTokenSettings = {
    locked: boolean;
    protected: ProtectedApiTokenSettings | null;
};

export type AccountSettingsProps = {
    profile: ProfileSettings;
    /** Absent, like the three sections under it, while the address of the account is not verified. */
    security: SecuritySettings | null;
    appearance: boolean;
    notificationPreferences: NotificationSettings | null;
    /** Absent too when the MCP server is off. */
    apiTokens: ApiTokenSettings | null;
};

function SecuritySection({
    security,
}: {
    security: SecuritySettings;
}): ReactElement {
    const { t } = useTrans();
    const { protected: account } = security;
    const listsEmailCode =
        account !== null &&
        (account.emailSecondFactor.available ||
            account.emailSecondFactor.enabled);

    return (
        <SecurityStack>
            <PasswordCard
                passwordRules={security.passwordRules}
                breachCheck={
                    security.checksCompromisedPasswords ? (
                        <PasswordBreachCheck />
                    ) : undefined
                }
            />
            {account === null && security.hasProtectedSettings && (
                <LockedSettingsCard
                    title={t('Sign-in protection')}
                    description={t(
                        'Confirm your password to see and change what protects your sign-in.',
                    )}
                    href={unlockSecurity()}
                />
            )}
            {account !== null &&
                (security.canManageTwoFactor || listsEmailCode) && (
                    <TwoFactorCard
                        enabled={account.twoFactorEnabled}
                        requiresConfirmation={security.requiresConfirmation}
                        summary={account.twoFactor}
                        appAvailable={security.canManageTwoFactor}
                        emailCode={account.emailSecondFactor}
                    />
                )}
            {account !== null && security.canManagePasskeys && (
                <PasskeysCard passkeys={account.passkeys} />
            )}
        </SecurityStack>
    );
}

function ApiTokensSection({
    apiTokens,
}: {
    apiTokens: ApiTokenSettings;
}): ReactElement {
    const { t } = useTrans();
    const flashedToken = usePage().flash.newToken ?? null;
    const [newToken, setNewToken] = useState<NewApiToken | null>(flashedToken);

    useEffect(() => {
        if (flashedToken !== null) {
            setNewToken(flashedToken);
        }
    }, [flashedToken]);

    if (apiTokens.protected === null) {
        return (
            <LockedSettingsCard
                title={t('API tokens')}
                description={t(
                    'Confirm your password to see, create and revoke your tokens.',
                )}
                href={unlockApiTokens()}
            />
        );
    }

    const { tokens, teamGroups, mcpUrl, expirationOptions, defaultExpiration } =
        apiTokens.protected;

    return (
        <>
            <div data-slot="api-tokens" className="flex min-w-0 flex-col gap-4">
                <CreateTokenForm
                    teamGroups={teamGroups}
                    expirationOptions={expirationOptions}
                    defaultExpiration={defaultExpiration}
                    mcpUrl={mcpUrl}
                    newToken={newToken}
                    onDone={() => setNewToken(null)}
                />
                <TokenList tokens={tokens} newTokenName={newToken?.name} />
            </div>

            <ServerUrl mcpUrl={mcpUrl} />
        </>
    );
}

/**
 * The account settings on one page: its sections under one another, the
 * navigation leading to each and marking the one in view.
 */
export function AccountSettings({
    profile,
    security,
    appearance,
    notificationPreferences,
    apiTokens,
}: AccountSettingsProps): ReactElement {
    const page = usePage<{ auth: Auth }>();
    const { auth } = page.props;
    const held: Record<SettingsSectionId, boolean> = {
        profile: true,
        security: security !== null,
        appearance,
        notifications: notificationPreferences !== null,
        'api-tokens': apiTokens !== null,
    };
    const sections = SettingsSections.filter((section) => held[section]);
    const { current, select } = useVisibleSection(sections, page.url);

    return (
        <SettingsShell
            sections={sections}
            current={current as SettingsSectionId}
            onSelect={select}
        >
            <SettingsSection id="profile">
                <div className="flex min-w-0 flex-col gap-4">
                    <ProfileCard
                        user={auth.user}
                        mustVerifyEmail={profile.mustVerifyEmail}
                        status={profile.status ?? undefined}
                    />
                    <DeleteAccountCard />
                </div>

                <AvatarStyleCard
                    user={auth.user}
                    memberChoice={profile.avatarMemberChoice}
                    style={profile.avatarStyle}
                    instanceStyle={profile.instanceAvatarStyle}
                    styles={profile.avatarStyles}
                />
            </SettingsSection>

            {security !== null && (
                <SettingsSection id="security">
                    <SecuritySection security={security} />
                </SettingsSection>
            )}

            {appearance && (
                <SettingsSection id="appearance">
                    <AppearanceCard
                        accessibility={
                            <ShortcutPreferenceCard
                                enabled={
                                    auth.user.single_key_shortcuts !== false
                                }
                            />
                        }
                    />
                </SettingsSection>
            )}

            {notificationPreferences !== null && (
                <SettingsSection id="notifications">
                    <NotificationsCard
                        preferences={notificationPreferences.preferences}
                        reminderTime={notificationPreferences.reminderTime}
                        remindersEnabled={
                            notificationPreferences.remindersEnabled
                        }
                    />
                </SettingsSection>
            )}

            {apiTokens !== null && (
                <SettingsSection id="api-tokens">
                    <ApiTokensSection apiTokens={apiTokens} />
                </SettingsSection>
            )}
        </SettingsShell>
    );
}
