import { usePage } from '@inertiajs/react';
import { Bell, KeyRound, Palette, Shield, User } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import type { SubNavItem } from '@/components/skrum/sub-nav';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import SettingsLayout from '@/layouts/skrum/settings-layout';
import { index as apiTokens } from '@/routes/apiTokens';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editNotifications } from '@/routes/notificationPreferences';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { Auth } from '@/types';

export type SettingsSection =
    | 'profile'
    | 'security'
    | 'appearance'
    | 'notifications'
    | 'apiTokens';

type SettingsNavEntry = Omit<SubNavItem, 'current'> & {
    section: SettingsSection;
};

export function SettingsShell({
    active,
    children,
}: {
    active: SettingsSection;
    children: ReactNode;
}): ReactElement {
    const { t } = useTrans();
    const { auth, features } = usePage<{ auth: Auth }>().props;
    /** The navigation takes its entries from this list: a new section is one more row. */
    const entries: SettingsNavEntry[] = [
        {
            section: 'profile',
            label: t('Profile'),
            icon: User,
            href: editProfile(),
        },
        {
            section: 'security',
            label: t('Security'),
            icon: Shield,
            href: editSecurity(),
        },
        {
            section: 'appearance',
            label: t('Appearance'),
            icon: Palette,
            href: editAppearance(),
        },
        {
            section: 'notifications',
            label: t('Notifications'),
            icon: Bell,
            href: editNotifications(),
        },
        ...(features.mcp
            ? [
                  {
                      section: 'apiTokens' as const,
                      label: t('API tokens'),
                      icon: KeyRound,
                      href: apiTokens(),
                  },
              ]
            : []),
    ];
    const current =
        entries.find((entry) => entry.section === active) ?? entries[0];

    return (
        <AppLayout
            breadcrumbs={[
                { title: auth.user.name, href: entries[0].href },
                { title: t('Settings'), href: current.href },
            ]}
        >
            <SettingsLayout
                title={t('Settings')}
                description={t('Your account, applied in every workspace')}
                nav={entries.map(({ section, ...entry }) => ({
                    ...entry,
                    current: section === active,
                }))}
            >
                <div
                    data-slot="settings-shell"
                    className="flex max-w-200 min-w-0 flex-col gap-10"
                >
                    {children}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
