import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { CreateTokenForm } from '@/components/settings/api-tokens/create-token-form';
import { ServerUrl } from '@/components/settings/api-tokens/server-url';
import { TokenList } from '@/components/settings/api-tokens/token-list';
import { AppearanceCard } from '@/components/settings/appearance/appearance-card';
import { ReduceMotionField } from '@/components/settings/appearance/reduce-motion-field';
import { ShortcutPreferenceCard } from '@/components/settings/appearance/shortcut-preference-card';
import { AvatarStyleCard } from '@/components/settings/avatar-style-card';
import type { ProfileAvatarStyle } from '@/components/settings/avatar-style-card';
import { DeleteAccountCard } from '@/components/settings/delete-account-card';
import { NotificationsCard } from '@/components/settings/notifications-card';
import type { NotificationPreferences } from '@/components/settings/notifications-card';
import { PasswordGateProvider } from '@/components/settings/password-gate';
import { PresenceColourPicker } from '@/components/settings/presence-colour-picker';
import { ProfileCard } from '@/components/settings/profile-card';
import { ProfilePhoto } from '@/components/settings/profile-photo';
import { ActiveSessionsCard } from '@/components/settings/security/active-sessions-card';
import type { BrowserSessionRow } from '@/components/settings/security/active-sessions-card';
import { LinkedAccountsCard } from '@/components/settings/security/linked-accounts-card';
import type { LinkedAccounts } from '@/components/settings/security/linked-accounts-card';
import { PasskeysCard } from '@/components/settings/security/passkeys-card';
import { PasswordCard } from '@/components/settings/security/password-card';
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
    instanceAvatarStyleName: string;
    avatarStyles: ProfileAvatarStyle[];
    /** The chosen colour, or the one derived from the avatar seed: 1 to 12. */
    presenceColor: number;
    /** A stored photo shows as the avatar; always false while photos are not allowed. */
    hasPhoto: boolean;
    /** The admin switch "Profile photos". */
    photosAllowed: boolean;
    /**
     * How the account confirms a protected action: its password, or a code
     * sent by e-mail when its owner knows no password. Null when no code can
     * reach it either: rule S-1, no confirmation in the account settings.
     */
    confirmsWith: 'password' | 'code' | null;
};

export type AppearanceSettings = {
    reduceMotion: boolean;
};

/** What the security section says about the account: sent only behind a confirmed password. */
export type ProtectedSecuritySettings = {
    twoFactorEnabled: boolean;
    twoFactor: TwoFactorSummary;
    passkeys: Passkey[];
    emailSecondFactor: EmailSecondFactor;
    password: {
        /** False when the account has no password its owner knows: the card sets a first one. */
        isSet: boolean;
        /** When the password was last set, as an ISO time. */
        changedAt: string | null;
        /** False when the sign-in policy refuses a password to this account: no password card. */
        allowed: boolean;
    };
    /** Null when the sessions are not kept in the database: no Active sessions card. */
    browserSessions: BrowserSessionRow[] | null;
    /** Every provider of the instance, and an identity of a provider turned off. */
    linkedAccounts: LinkedAccounts;
};

export type SecuritySettings = {
    passwordRules: string;
    /** The server refuses a password found in known data breaches. */
    checksCompromisedPasswords: boolean;
    /** The instance answers the breach ranges: the password is checked while typed. */
    liveBreachCheck: boolean;
    canManageTwoFactor: boolean;
    canManagePasskeys: boolean;
    /** The instance can send the e-mail code. */
    canManageEmailCode: boolean;
    requiresConfirmation: boolean;
    /** The sessions are kept in the database: the Active sessions card exists. */
    canListBrowserSessions: boolean;
    /** The instance has a sign-in provider: the Linked accounts card exists before the confirmation. */
    canLinkAccounts: boolean;
    locked: boolean;
    protected: ProtectedSecuritySettings | null;
};

export type NotificationSettings = {
    preferences: NotificationPreferences;
    reminderTime: string;
    reminderTimezone: string;
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
    /** False, like the sections under it, while the address of the account is not verified. */
    appearance: AppearanceSettings | null;
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
    confirmsWithCode,
    identity,
}: {
    security: SecuritySettings;
    /** The e-mail and the name of the account: a new password must differ from them. */
    identity: string[];
    /** The account has no password yet: its card shows once the code confirmed the session. */
    confirmsWithCode: boolean;
}): ReactElement {
    const { protected: account } = security;
    const listsEmailCode =
        account !== null &&
        (account.emailSecondFactor.available ||
            account.emailSecondFactor.enabled);
    const listsBrowserSessions =
        security.canListBrowserSessions &&
        (account === null || account.browserSessions !== null);
    const listsLinkedAccounts =
        account === null
            ? security.canLinkAccounts
            : account.linkedAccounts.rows.length > 0;

    return (
        <SecurityStack
            activeSessions={
                listsBrowserSessions && (
                    <ActiveSessionsCard
                        sessions={account?.browserSessions ?? null}
                    />
                )
            }
            linkedAccounts={
                listsLinkedAccounts && (
                    <LinkedAccountsCard
                        accounts={account?.linkedAccounts ?? null}
                    />
                )
            }
        >
            {account?.password.allowed !== false &&
                !(account === null && confirmsWithCode) && (
                    <PasswordCard
                        passwordRules={security.passwordRules}
                        checksCompromisedPasswords={
                            security.checksCompromisedPasswords
                        }
                        liveBreachCheck={security.liveBreachCheck}
                        isSet={account?.password.isSet ?? true}
                        changedAt={account?.password.changedAt}
                        identity={identity}
                    />
                )}
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
        appearance: appearance !== null,
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
                confirmsWith={profile.confirmsWith}
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
                            photo={
                                <ProfilePhoto
                                    photosAllowed={profile.photosAllowed}
                                    hasPhoto={profile.hasPhoto}
                                    memberChoice={profile.avatarMemberChoice}
                                    style={
                                        profile.avatarStyle ??
                                        profile.instanceAvatarStyle
                                    }
                                />
                            }
                        />
                        <DeleteAccountCard
                            confirmsWith={profile.confirmsWith}
                        />
                    </div>

                    <AvatarStyleCard
                        key={profile.avatarStyle ?? ''}
                        user={auth.user}
                        memberChoice={profile.avatarMemberChoice}
                        style={profile.avatarStyle}
                        instanceStyle={profile.instanceAvatarStyle}
                        instanceStyleName={profile.instanceAvatarStyleName}
                        styles={profile.avatarStyles}
                    />
                </SettingsSection>

                {security !== null && (
                    <SettingsSection id="security">
                        <SecuritySection
                            security={security}
                            confirmsWithCode={profile.confirmsWith === 'code'}
                            identity={[auth.user.email, auth.user.name]}
                        />
                    </SettingsSection>
                )}

                {appearance !== null && (
                    <SettingsSection id="appearance">
                        <AppearanceCard
                            reduceAnimations={
                                <ReduceMotionField
                                    enabled={appearance.reduceMotion}
                                />
                            }
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
                            reminderTimezone={
                                notificationPreferences.reminderTimezone
                            }
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
