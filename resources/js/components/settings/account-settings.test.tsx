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
    tokens: undefined as unknown,
    createToken: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/components/settings/profile-card', () => ({
    ProfileCard: () => <p>profile card</p>,
}));
vi.mock('@/components/settings/delete-account-card', () => ({
    DeleteAccountCard: () => <p>delete account card</p>,
}));
vi.mock('@/components/settings/avatar-style-card', () => ({
    AvatarStyleCard: () => <p>avatar style card</p>,
}));
vi.mock('@/components/settings/security/password-card', () => ({
    PasswordCard: ({ breachCheck }: { breachCheck?: ReactNode }) => (
        <p>password card{breachCheck !== undefined && ' with breach check'}</p>
    ),
}));
vi.mock('@/components/settings/security/password-strength', () => ({
    PasswordBreachCheck: () => null,
}));
vi.mock('@/components/settings/security/two-factor-card', () => ({
    TwoFactorCard: (props: Record<string, unknown>) => {
        seen.twoFactor = props;

        return <p>two-factor card</p>;
    },
}));
vi.mock('@/components/settings/security/passkeys-card', () => ({
    PasskeysCard: ({ passkeys }: { passkeys: unknown }) => {
        seen.passkeys = passkeys;

        return <p>passkeys card</p>;
    },
}));
vi.mock('@/components/settings/appearance/appearance-card', () => ({
    AppearanceCard: ({ accessibility }: { accessibility: ReactNode }) => (
        <div>
            <p>appearance card</p>
            {accessibility}
        </div>
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
    TokenList: ({ tokens }: { tokens: unknown }) => {
        seen.tokens = tokens;

        return <p>token list</p>;
    },
}));
vi.mock('@/components/settings/api-tokens/server-url', () => ({
    ServerUrl: ({ mcpUrl }: { mcpUrl: string }) => <p>server {mcpUrl}</p>,
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

function unlocked(): AccountSettingsProps {
    return {
        profile: {
            mustVerifyEmail: true,
            status: null,
            avatarMemberChoice: false,
            avatarStyle: null,
            instanceAvatarStyle: 'thumbs',
            avatarStyles: [],
        },
        security: {
            passwordRules: 'minlength: 12;',
            checksCompromisedPasswords: true,
            canManageTwoFactor: true,
            canManagePasskeys: true,
            requiresConfirmation: true,
            hasProtectedSettings: true,
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
            },
        },
        appearance: true,
        notificationPreferences: {
            preferences: {
                action_item_reminders_by_email: true,
                action_item_reminders_in_app: true,
                recap_emails: true,
                recap_in_app: true,
            },
            reminderTime: '08:00',
            remindersEnabled: true,
        },
        apiTokens: {
            locked: false,
            protected: {
                tokens: [token] as never,
                teamGroups: [],
                mcpUrl: 'https://skrum.test/mcp',
                expirationOptions: [],
                defaultExpiration: '90_days',
            },
        },
    };
}

function locked(): AccountSettingsProps {
    const props = unlocked();

    return {
        ...props,
        security: { ...props.security!, locked: true, protected: null },
        apiTokens: { locked: true, protected: null },
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
        auth: { user: { name: 'Mona Member', single_key_shortcuts: true } },
    };
    seen.twoFactor = undefined;
    seen.passkeys = undefined;
    seen.tokens = undefined;
    seen.createToken = undefined;
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
            'password card with breach checktwo-factor cardpasskeys card',
        );
        expect(cards('Appearance')).toBe('appearance cardshortcuts on');
        expect(cards('Notifications')).toBe('notifications card');
        expect(cards('API tokens')).toBe(
            'create token formtoken listserver https://skrum.test/mcp',
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
    });

    it('replaces what the server keeps back by a locked card that leads to the password confirmation of its section', () => {
        renderWithProviders(<AccountSettings {...locked()} />);

        const security = sectionNamed('Security');
        const apiTokens = sectionNamed('API tokens');

        expect(security.textContent).toContain('password card');
        expect(security.textContent).not.toContain('two-factor card');
        expect(security.textContent).not.toContain('passkeys card');
        expect(
            within(security).getByRole('heading', {
                level: 2,
                name: 'Sign-in protection',
            }),
        ).toBeTruthy();
        expect(
            within(security)
                .getByRole('link', { name: 'Confirm password' })
                .getAttribute('href'),
        ).toBe('/settings/security');

        expect(apiTokens.textContent).not.toContain('create token form');
        expect(apiTokens.textContent).not.toContain('token list');
        expect(apiTokens.textContent).not.toContain('server');
        expect(
            within(apiTokens).getByRole('heading', {
                level: 2,
                name: 'API tokens',
            }),
        ).toBeTruthy();
        expect(
            within(apiTokens)
                .getByRole('link', { name: 'Confirm password' })
                .getAttribute('href'),
        ).toBe('/settings/api-tokens');
        expect(navigation()).toHaveLength(5);
    });

    it('shows no locked card in the security section when the instance has nothing behind the lock', () => {
        const props = locked();

        renderWithProviders(
            <AccountSettings
                {...props}
                security={{
                    ...props.security!,
                    canManageTwoFactor: false,
                    canManagePasskeys: false,
                    hasProtectedSettings: false,
                }}
            />,
        );

        expect(sectionNamed('Security').textContent).toBe(
            'password card with breach check',
        );
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
            'password card with breach check',
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

    it('gives an account whose address is not verified its profile only', () => {
        renderWithProviders(
            <AccountSettings
                {...unlocked()}
                security={null}
                appearance={false}
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
