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
import { NotificationsCard } from '@/components/settings/notifications-card';
import type { NotificationPreferences } from '@/components/settings/notifications-card';
import { PasswordGateProvider } from '@/components/settings/password-gate';
import { PresenceColourPicker } from '@/components/settings/presence-colour-picker';
import { ProfileCard } from '@/components/settings/profile-card';
import { PasskeysCard } from '@/components/settings/security/passkeys-card';
import { PasswordCard } from '@/components/settings/security/password-card';
import { PasswordBreachCheck } from '@/components/settings/security/password-strength';
import { SecurityStack } from '@/components/settings/security/security-stack';
import {
    TwoFactorCard,
    TwoFactorConcealed,
} from '@/components/settings/security/two-factor-card';
import {
    SettingsSection,
    SettingsSections,
    SettingsShell,
} from '@/components/settings/settings-shell';
import type { SettingsSectionId } from '@/components/settings/settings-shell';
import { useVisibleSection } from '@/components/settings/use-visible-section';
import type { AvatarPresence } from '@/components/ui/avatar';
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
    /** The chosen colour, or the one derived from the avatar seed: 1 to 12. */
    presenceColor: number;
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
    /** The instance can send the e-mail code. */
    canManageEmailCode: boolean;
    requiresConfirmation: boolean;
    locked: boolean;
    protected: ProtectedSecuritySettings | null;
};

export type NotificationSettings = {
    preferences: NotificationPreferences;
    reminderTime: string;
    remindersEnabled: boolean;
};

/** What the API token section says about the account: sent only behind a confirmed password. */
export type ProtectedApiTokenSettings = {
    tokens: ApiToken[];
    teamGroups: ApiTokenTeamGroup[];
    mcpUrl: string;
};

export type ApiTokenSettings = {
    expirationOptions: ApiTokenExpirationOption[];
    defaultExpiration: ApiTokenExpiration;
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

/**
 * Before the password is confirmed the cards are there with what the
 * instance offers and nothing of the account; each of their actions asks
 * for the password, then the page loads the rest.
 */
function SecuritySection({
    security,
}: {
    security: SecuritySettings;
}): ReactElement {
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
            {account === null &&
                (security.canManageTwoFactor ||
                    security.canManageEmailCode) && (
                    <TwoFactorConcealed
                        appAvailable={security.canManageTwoFactor}
                        emailCodeAvailable={security.canManageEmailCode}
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
            {security.canManagePasskeys && (
                <PasskeysCard passkeys={account?.passkeys ?? null} />
            )}
        </SecurityStack>
    );
}

function ApiTokensSection({
    apiTokens,
}: {
    apiTokens: ApiTokenSettings;
}): ReactElement {
    const flashedToken = usePage().flash.newToken ?? null;
    const [newToken, setNewToken] = useState<NewApiToken | null>(flashedToken);

    useEffect(() => {
        if (flashedToken !== null) {
            setNewToken(flashedToken);
        }
    }, [flashedToken]);

    const account = apiTokens.protected;
    const mcpUrl = account?.mcpUrl ?? null;

    return (
        <>
            <div data-slot="api-tokens" className="flex min-w-0 flex-col gap-4">
                <CreateTokenForm
                    teamGroups={account?.teamGroups ?? null}
                    expirationOptions={apiTokens.expirationOptions}
                    defaultExpiration={apiTokens.defaultExpiration}
                    mcpUrl={mcpUrl}
                    newToken={newToken}
                    onDone={() => setNewToken(null)}
                />
                <TokenList
                    tokens={account?.tokens ?? null}
                    newTokenName={newToken?.name}
                />
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
    const [presence, setPresence] = useState(profile.presenceColor);

    return (
        <SettingsShell
            sections={sections}
            current={current as SettingsSectionId}
            onSelect={select}
        >
            <PasswordGateProvider
                locked={security?.locked === true || apiTokens?.locked === true}
                passkeys={security?.canManagePasskeys === true}
            >
                <SettingsSection id="profile">
                    <div className="flex min-w-0 flex-col gap-4">
                        <ProfileCard
                            user={auth.user}
                            mustVerifyEmail={profile.mustVerifyEmail}
                            status={profile.status ?? undefined}
                            presence={presence as AvatarPresence}
                            presenceColours={
                                <PresenceColourPicker
                                    value={presence}
                                    onChange={setPresence}
                                />
                            }
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
            </PasswordGateProvider>
        </SettingsShell>
    );
}
