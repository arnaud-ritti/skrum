import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AccountSettings } from './account-settings';
import type { AccountSettingsProps } from './account-settings';

const page = vi.hoisted(() => ({
    url: '/settings',
    props: {} as Record<string, unknown>,
    flash: {} as Record<string, unknown>,
}));
const seen = vi.hoisted(() => ({
    twoFactor: undefined as Record<string, unknown> | undefined,
    passkeys: undefined as unknown,
    browserSessions: undefined as unknown,
    linkedAccounts: undefined as unknown,
    tokens: undefined as unknown,
    newTokenName: undefined as string | undefined,
    createToken: undefined as Record<string, unknown> | undefined,
    concealed: undefined as Record<string, unknown> | undefined,
    serverUrl: undefined as unknown,
    gate: undefined as Record<string, unknown> | undefined,
    deleteAccount: undefined as Record<string, unknown> | undefined,
    password: undefined as Record<string, unknown> | undefined,
    profile: undefined as
        | { presence?: number; presenceColours?: ReactNode; photo?: ReactNode }
        | undefined,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/components/settings/password-gate', () => ({
    PasswordGateProvider: ({ children, ...props }: { children: ReactNode }) => {
        seen.gate = props;

        return <>{children}</>;
    },
}));
vi.mock('@/components/settings/profile-card', () => ({
    ProfileCard: (props: {
        presence?: number;
        presenceColours?: ReactNode;
        photo?: ReactNode;
    }) => {
        seen.profile = props;

        return <p>profile card</p>;
    },
}));
vi.mock('@/components/settings/profile-photo', () => ({
    ProfilePhoto: (props: Record<string, unknown>) => (
        <p>profile photo {JSON.stringify(props)}</p>
    ),
}));
vi.mock('@/components/settings/delete-account-card', () => ({
    DeleteAccountCard: (props: Record<string, unknown>) => {
        seen.deleteAccount = props;

        return <p>delete account card</p>;
    },
}));
vi.mock('@/components/settings/avatar-style-card', () => ({
    AvatarStyleCard: () => <p>avatar style card</p>,
}));
vi.mock('@/components/settings/security/password-card', () => ({
    PasswordCard: (props: { checksCompromisedPasswords: boolean }) => {
        seen.password = props;

        return (
            <p>
                password card
                {props.checksCompromisedPasswords && ' with breach check'}
            </p>
        );
    },
}));
vi.mock('@/components/settings/security/two-factor-card', () => ({
    TwoFactorCard: (props: Record<string, unknown>) => {
        seen.twoFactor = props;

        return <p>two-factor card</p>;
    },
    TwoFactorConcealed: (props: Record<string, unknown>) => {
        seen.concealed = props;

        return <p>concealed two-factor card</p>;
    },
}));
vi.mock('@/components/settings/security/passkeys-card', () => ({
    PasskeysCard: ({ passkeys }: { passkeys: unknown }) => {
        seen.passkeys = passkeys;

        return <p>passkeys card</p>;
    },
}));
vi.mock('@/components/settings/security/active-sessions-card', () => ({
    ActiveSessionsCard: ({ sessions }: { sessions: unknown }) => {
        seen.browserSessions = sessions;

        return <p>active sessions card</p>;
    },
}));
vi.mock('@/components/settings/security/linked-accounts-card', () => ({
    LinkedAccountsCard: ({ accounts }: { accounts: unknown }) => {
        seen.linkedAccounts = accounts;

        return <p>linked accounts card</p>;
    },
}));
vi.mock('@/components/settings/appearance/appearance-card', () => ({
    AppearanceCard: ({
        reduceAnimations,
        accessibility,
    }: {
        reduceAnimations: ReactNode;
        accessibility: ReactNode;
    }) => (
        <div>
            <p>appearance card</p>
            {reduceAnimations}
            {accessibility}
        </div>
    ),
}));
vi.mock('@/components/settings/appearance/reduce-motion-field', () => ({
    ReduceMotionField: ({ enabled }: { enabled: boolean }) => (
        <p>reduce motion {enabled ? 'on' : 'off'}</p>
    ),
}));
vi.mock('@/components/settings/appearance/shortcut-preference-card', () => ({
    ShortcutPreferenceCard: ({ enabled }: { enabled: boolean }) => (
        <p>shortcuts {enabled ? 'on' : 'off'}</p>
    ),
}));
vi.mock('@/components/settings/notifications-card', () => ({
    NotificationsCard: () => <p>notifications card</p>,
}));
vi.mock('@/components/settings/api-tokens/create-token-form', () => ({
    CreateTokenForm: (props: Record<string, unknown>) => {
        seen.createToken = props;

        return <p>create token form</p>;
    },
}));
vi.mock('@/components/settings/api-tokens/token-list', () => ({
    TokenList: ({
        tokens,
        newTokenName,
    }: {
        tokens: unknown;
        newTokenName?: string;
    }) => {
        seen.tokens = tokens;
        seen.newTokenName = newTokenName;

        return <p>token list</p>;
    },
}));
vi.mock('@/components/settings/api-tokens/server-url', () => ({
    ServerUrl: ({ mcpUrl }: { mcpUrl: string | null }) => {
        seen.serverUrl = mcpUrl;

        return <p>server {mcpUrl}</p>;
    },
}));

const scrollIntoView = vi.fn();

const passkey = {
    id: 'p1',
    name: 'Laptop',
    authenticator: null,
    created_at_diff: '1 day ago',
    last_used_at_diff: null,
};

const token = { id: 't1', name: 'Claude Code' };

const linkedAccounts = {
    rows: [
        {
            provider: 'google',
            label: 'Google',
            isEnabled: true,
            account: {
                id: '0199a000-0000-7000-8000-000000000001',
                linkedAt: '2025-11-18T10:00:00+00:00',
                isManaged: false,
                canUnlink: true,
            },
        },
    ],
    lastWayIn: false,
};

const browserSession = {
    key: 'a'.repeat(64),
    device: 'Firefox on macOS',
    deviceKind: 'desktop' as const,
    ipAddress: '203.0.113.7',
    isCurrent: true,
    lastActiveAt: '2026-10-03T12:00:00Z',
};

function unlocked(): AccountSettingsProps {
    return {
        profile: {
            mustVerifyEmail: true,
            status: null,
            avatarMemberChoice: false,
            avatarStyle: null,
            instanceAvatarStyle: 'thumbs',
            instanceAvatarStyleName: 'Thumbs',
            avatarStyles: [],
            presenceColor: 7,
            hasPhoto: true,
            photosAllowed: true,
            confirmsWith: 'password',
        },
        security: {
            passwordRules: 'minlength: 12;',
            checksCompromisedPasswords: true,
            liveBreachCheck: true,
            canManageTwoFactor: true,
            canManagePasskeys: true,
            canManageEmailCode: true,
            requiresConfirmation: true,
            canListBrowserSessions: true,
            canLinkAccounts: true,
            locked: false,
            protected: {
                twoFactorEnabled: true,
                twoFactor: {
                    confirmedAt: '2026-01-01T00:00:00Z',
                    recoveryCodesRemaining: 8,
                    recoveryCodesTotal: 8,
                },
                passkeys: [passkey],
                emailSecondFactor: {
                    available: true,
                    enabled: false,
                    address: 'mona@example.com',
                    resendIn: 0,
                },
                password: { isSet: true, changedAt: null, allowed: true },
                browserSessions: [browserSession],
                linkedAccounts,
            },
        },
        appearance: { reduceMotion: true },
        notificationPreferences: {
            preferences: {
                action_item_reminders_by_email: true,
                action_item_reminders_in_app: true,
                recap_emails: true,
                recap_in_app: true,
            },
            reminderTime: '08:00',
            reminderTimezone: 'UTC',
            remindersEnabled: true,
        },
        apiTokens: {
            expirationOptions: [],
            defaultExpiration: '90_days',
            locked: false,
            protected: {
                tokens: [token] as never,
                teamGroups: [],
                mcpUrl: 'https://skrum.test/mcp',
            },
        },
    };
}

function locked(): AccountSettingsProps {
    const props = unlocked();

    return {
        ...props,
        security: { ...props.security!, locked: true, protected: null },
        apiTokens: { ...props.apiTokens!, locked: true, protected: null },
    };
}

const SectionNames: Record<string, string> = {
    profile: 'Profile',
    security: 'Security',
    appearance: 'Appearance',
    notifications: 'Notifications',
    'api-tokens': 'API tokens',
};

function regions(): string[] {
    return Array.from(
        document.querySelectorAll('[data-slot="settings-section"]'),
    ).map((section) => SectionNames[section.id]);
}

function sectionNamed(name: string): HTMLElement {
    const id = Object.keys(SectionNames).find(
        (key) => SectionNames[key] === name,
    );

    return document.getElementById(id ?? '') as HTMLElement;
}

function navigation(): string[] {
    return within(screen.getByRole('navigation', { name: 'Settings' }))
        .getAllByRole('link')
        .map((link) => link.textContent ?? '');
}

beforeEach(() => {
    page.url = '/settings';
    page.flash = {};
    page.props = {
        translations: {},
        auth: {
            user: {
                name: 'Mona Member',
                email: 'mona@example.test',
                single_key_shortcuts: true,
            },
        },
    };
    seen.twoFactor = undefined;
    seen.passkeys = undefined;
    seen.browserSessions = undefined;
    seen.linkedAccounts = undefined;
    seen.tokens = undefined;
    seen.createToken = undefined;
    seen.concealed = undefined;
    seen.serverUrl = undefined;
    seen.gate = undefined;
    seen.profile = undefined;
    seen.password = undefined;
    window.history.replaceState(null, '', '/settings');
    scrollIntoView.mockClear();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
});

describe('AccountSettings', () => {
    it('stacks the five sections on one page, in the order of the navigation', () => {
        renderWithProviders(<AccountSettings {...unlocked()} />);

        const expected = [
            'Profile',
            'Security',
            'Appearance',
            'Notifications',
            'API tokens',
        ];

        expect(regions()).toEqual(expected);
        expect(navigation()).toEqual(expected);
        expect(
            screen
                .getAllByRole('heading', { level: 1 })
                .map((h) => h.textContent),
        ).toEqual(['Settings']);
    });

    it('keeps every card of the old pages in its section', () => {
        renderWithProviders(<AccountSettings {...unlocked()} />);

        const cards = (name: string): string =>
            sectionNamed(name).textContent ?? '';

        expect(cards('Profile')).toBe(
            'profile carddelete account cardavatar style card',
        );
        expect(cards('Security')).toBe(
            'password card with breach checktwo-factor cardpasskeys cardactive sessions cardlinked accounts card',
        );
        expect(cards('Appearance')).toBe(
            'appearance cardreduce motion onshortcuts on',
        );
        expect(cards('Notifications')).toBe('notifications card');
        expect(cards('API tokens')).toBe(
            'create token formtoken listserver https://skrum.test/mcp',
        );
    });

    it('mounts the presence colour picker, the avatar following the choice before it is saved', () => {
        renderWithProviders(<AccountSettings {...unlocked()} />);

        expect(seen.profile?.presence).toBe(7);

        renderWithProviders(<>{seen.profile?.presenceColours}</>);

        expect(
            screen
                .getByRole('radio', { name: 'Colour 7' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(screen.getByRole('radio', { name: 'Colour 3' }));

        expect(seen.profile?.presence).toBe(3);
    });

    it('mounts the photo block with the switch, the photo and the style the avatar draws without it', () => {
        const props = unlocked();
        renderWithProviders(
            <AccountSettings
                {...props}
                profile={{
                    ...props.profile,
                    avatarMemberChoice: true,
                    avatarStyle: null,
                }}
            />,
        );

        renderWithProviders(<>{seen.profile?.photo}</>);

        expect(screen.getByText(/^profile photo/).textContent).toBe(
            `profile photo ${JSON.stringify({
                photosAllowed: true,
                hasPhoto: true,
                memberChoice: true,
                style: 'thumbs',
            })}`,
        );
    });

    it('hands the protected state to the cards once the server sent it', () => {
        renderWithProviders(<AccountSettings {...unlocked()} />);

        expect(seen.twoFactor).toMatchObject({
            enabled: true,
            requiresConfirmation: true,
            appAvailable: true,
            summary: { recoveryCodesRemaining: 8 },
            emailCode: { address: 'mona@example.com' },
        });
        expect(seen.passkeys).toEqual([passkey]);
        expect(seen.browserSessions).toEqual([browserSession]);
        expect(seen.linkedAccounts).toEqual(linkedAccounts);
        expect(seen.tokens).toEqual([token]);
        expect(seen.createToken).toMatchObject({
            mcpUrl: 'https://skrum.test/mcp',
            defaultExpiration: '90_days',
            newToken: null,
        });
    });

    it('shows a token that was just created to the form and the list', () => {
        page.flash = { newToken: { name: 'Claude Code', plainText: 'secret' } };

        renderWithProviders(<AccountSettings {...unlocked()} />);

        expect(seen.createToken).toMatchObject({
            newToken: { name: 'Claude Code', plainText: 'secret' },
        });
        expect(seen.newTokenName).toBe('Claude Code');
    });

    it('draws the protected cards before the password is confirmed, with nothing of the account in them', () => {
        renderWithProviders(<AccountSettings {...locked()} />);

        expect(sectionNamed('Security').textContent).toBe(
            'password card with breach checkconcealed two-factor cardpasskeys cardactive sessions cardlinked accounts card',
        );
        expect(sectionNamed('API tokens').textContent).toBe(
            'create token formtoken listserver ',
        );
        expect(seen.twoFactor).toBeUndefined();
        expect(seen.concealed).toEqual({
            appAvailable: true,
            emailCodeAvailable: true,
        });
        expect(seen.passkeys).toBeNull();
        expect(seen.browserSessions).toBeNull();
        expect(seen.linkedAccounts).toBeNull();
        expect(seen.tokens).toBeNull();
        expect(seen.serverUrl).toBeNull();
        expect(seen.createToken).toMatchObject({
            teamGroups: null,
            mcpUrl: null,
            defaultExpiration: '90_days',
        });
        expect(screen.queryByText('Locked')).toBeNull();
        expect(
            screen.queryByRole('link', { name: 'Confirm password' }),
        ).toBeNull();
        expect(navigation()).toHaveLength(5);
    });

    it('tells the gate of the page whether the server kept something back, and whether a passkey may confirm', () => {
        const { unmount } = renderWithProviders(
            <AccountSettings {...locked()} />,
        );

        expect(seen.gate).toEqual({
            locked: true,
            passkeys: true,
            confirmsWith: 'password',
        });

        unmount();
        renderWithProviders(
            <AccountSettings
                {...unlocked()}
                security={{ ...unlocked().security!, canManagePasskeys: false }}
            />,
        );

        expect(seen.gate).toEqual({
            locked: false,
            passkeys: false,
            confirmsWith: 'password',
        });
        expect(seen.deleteAccount).toEqual({ confirmsWith: 'password' });
    });

    it('tells the gate how an account without a known password confirms', () => {
        const props = unlocked();
        const { unmount } = renderWithProviders(
            <AccountSettings
                {...props}
                profile={{ ...props.profile, confirmsWith: null }}
            />,
        );

        expect(seen.gate).toMatchObject({ confirmsWith: null });
        expect(seen.deleteAccount).toEqual({ confirmsWith: null });

        unmount();
        renderWithProviders(
            <AccountSettings
                {...props}
                profile={{ ...props.profile, confirmsWith: 'code' }}
            />,
        );

        expect(seen.gate).toMatchObject({ confirmsWith: 'code' });
        expect(seen.deleteAccount).toEqual({ confirmsWith: 'code' });
    });

    it('hands the password card the breach check of the instance and whether the account has a password', () => {
        const props = unlocked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{
                    ...props.security!,
                    liveBreachCheck: false,
                    protected: {
                        ...props.security!.protected!,
                        password: {
                            isSet: false,
                            changedAt: null,
                            allowed: true,
                        },
                    },
                }}
            />,
        );

        expect(seen.password).toEqual({
            passwordRules: 'minlength: 12;',
            checksCompromisedPasswords: true,
            liveBreachCheck: false,
            isSet: false,
            changedAt: null,
            identity: ['mona@example.test', 'Mona Member'],
        });
    });

    it('updates a password before the confirmation, the state of the account being unknown', () => {
        renderWithProviders(<AccountSettings {...locked()} />);

        expect(seen.password).toMatchObject({ isSet: true });
    });

    it('draws no password card when the sign-in policy refuses a password to the account', () => {
        const props = unlocked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{
                    ...props.security!,
                    protected: {
                        ...props.security!.protected!,
                        password: {
                            isSet: false,
                            changedAt: null,
                            allowed: false,
                        },
                    },
                }}
            />,
        );

        expect(seen.password).toBeUndefined();
        expect(sectionNamed('Security').textContent).not.toContain(
            'password card',
        );
    });

    it('draws no two-factor card before the confirmation when the instance offers no method', () => {
        const props = locked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{
                    ...props.security!,
                    canManageTwoFactor: false,
                    canManagePasskeys: false,
                    canManageEmailCode: false,
                }}
            />,
        );

        expect(sectionNamed('Security').textContent).toBe(
            'password card with breach checkactive sessions cardlinked accounts card',
        );
    });

    it('lists only the e-mail code before the confirmation when the instance offers no authenticator app', () => {
        const props = locked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{ ...props.security!, canManageTwoFactor: false }}
            />,
        );

        expect(seen.concealed).toEqual({
            appAvailable: false,
            emailCodeAvailable: true,
        });
    });

    it('shows the cards the instance offers: no authenticator card without a second factor, no passkey card without passkeys', () => {
        const props = unlocked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{
                    ...props.security!,
                    canManageTwoFactor: false,
                    canManagePasskeys: false,
                    protected: {
                        ...props.security!.protected!,
                        emailSecondFactor: {
                            available: false,
                            enabled: false,
                            address: 'mona@example.com',
                            resendIn: 0,
                        },
                    },
                }}
            />,
        );

        expect(sectionNamed('Security').textContent).toBe(
            'password card with breach checkactive sessions cardlinked accounts card',
        );
    });

    it('still lists the e-mail code of an account that has it when the instance offers no authenticator app', () => {
        const props = unlocked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{
                    ...props.security!,
                    canManageTwoFactor: false,
                    protected: {
                        ...props.security!.protected!,
                        emailSecondFactor: {
                            available: false,
                            enabled: true,
                            address: 'mona@example.com',
                            resendIn: 0,
                        },
                    },
                }}
            />,
        );

        expect(seen.twoFactor).toMatchObject({ appAvailable: false });
    });

    it('mounts no Active sessions card when the sessions are not kept in the database, locked or not', () => {
        const props = unlocked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{
                    ...props.security!,
                    canListBrowserSessions: false,
                    protected: {
                        ...props.security!.protected!,
                        browserSessions: null,
                    },
                }}
            />,
        );

        expect(sectionNamed('Security').textContent).not.toContain(
            'active sessions card',
        );

        const closed = locked();

        renderWithProviders(
            <AccountSettings
                {...closed}
                security={{
                    ...closed.security!,
                    canListBrowserSessions: false,
                }}
            />,
        );

        expect(seen.browserSessions).toBeUndefined();
    });

    it('mounts no Linked accounts card when the instance has no provider, locked, or no row once unlocked', () => {
        const closed = locked();

        renderWithProviders(
            <AccountSettings
                {...closed}
                security={{ ...closed.security!, canLinkAccounts: false }}
            />,
        );

        expect(seen.linkedAccounts).toBeUndefined();

        const props = unlocked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{
                    ...props.security!,
                    canLinkAccounts: false,
                    protected: {
                        ...props.security!.protected!,
                        linkedAccounts: { rows: [], lastWayIn: false },
                    },
                }}
            />,
        );

        expect(seen.linkedAccounts).toBeUndefined();
    });

    it('keeps the identity of a provider turned off listed once unlocked, even with no provider left', () => {
        const props = unlocked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{ ...props.security!, canLinkAccounts: false }}
            />,
        );

        expect(seen.linkedAccounts).toEqual(linkedAccounts);
    });

    it('gives an account whose address is not verified its profile only', () => {
        renderWithProviders(
            <AccountSettings
                {...unlocked()}
                security={null}
                appearance={null}
                notificationPreferences={null}
                apiTokens={null}
            />,
        );

        expect(regions()).toEqual(['Profile']);
        expect(navigation()).toEqual(['Profile']);
    });

    it('has no API token section when the MCP server is off', () => {
        renderWithProviders(
            <AccountSettings {...unlocked()} apiTokens={null} />,
        );

        expect(regions()).toEqual([
            'Profile',
            'Security',
            'Appearance',
            'Notifications',
        ]);
        expect(navigation()).not.toContain('API tokens');
    });

    it('scrolls to the section chosen in the navigation, marks it and keeps the page', () => {
        renderWithProviders(<AccountSettings {...unlocked()} />);

        const link = screen.getByRole('link', { name: 'Notifications' });
        const section = sectionNamed('Notifications');

        expect(fireEvent.click(link)).toBe(false);

        expect(scrollIntoView.mock.instances).toContain(section);
        expect(link.getAttribute('aria-current')).toBe('location');
        expect(window.location.hash).toBe('#notifications');
        expect(document.activeElement).toBe(section);
    });

    it('opens on the section the address names', () => {
        window.history.replaceState(null, '', '/settings#security');
        page.url = '/settings#security';

        renderWithProviders(<AccountSettings {...unlocked()} />);

        expect(
            screen
                .getByRole('link', { name: 'Security' })
                .getAttribute('aria-current'),
        ).toBe('location');
    });
});
