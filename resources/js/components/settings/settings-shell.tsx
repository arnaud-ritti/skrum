import { usePage } from '@inertiajs/react';
import { Bell, KeyRound, Palette, Shield, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import SettingsLayout from '@/layouts/skrum/settings-layout';
import { edit as editSettings } from '@/routes/settings';
import type { Auth } from '@/types';

/** The anchor of each section of the account settings, in the order of the page. */
export const SettingsSections = [
    'profile',
    'security',
    'appearance',
    'notifications',
    'api-tokens',
] as const;

export type SettingsSectionId = (typeof SettingsSections)[number];

const SectionIcons: Record<SettingsSectionId, LucideIcon> = {
    profile: User,
    security: Shield,
    appearance: Palette,
    notifications: Bell,
    'api-tokens': KeyRound,
};

function useSettingsSectionLabels(): Record<SettingsSectionId, string> {
    const { t } = useTrans();

    return {
        profile: t('Profile'),
        security: t('Security'),
        appearance: t('Appearance'),
        notifications: t('Notifications'),
        'api-tokens': t('API tokens'),
    };
}

export function SettingsShell({
    sections,
    current,
    onSelect,
    children,
}: {
    /** The sections the page holds; the navigation lists them in the order of the page. */
    sections: readonly SettingsSectionId[];
    /** The section in view. */
    current: SettingsSectionId;
    onSelect: (section: SettingsSectionId) => void;
    children: ReactNode;
}): ReactElement {
    const { t } = useTrans();
    const { auth } = usePage<{ auth: Auth }>().props;
    const labels = useSettingsSectionLabels();

    return (
        <AppLayout
            breadcrumbs={[
                { title: auth.user.name, href: editSettings() },
                { title: t('Settings'), href: editSettings() },
            ]}
        >
            <SettingsLayout
                title={t('Settings')}
                description={t('Your account, applied in every workspace')}
                nav={SettingsSections.filter((section) =>
                    sections.includes(section),
                ).map((section) => ({
                    label: labels[section],
                    icon: SectionIcons[section],
                    href: `#${section}`,
                    current: section === current,
                    inPage: true,
                    onSelect: (event) => {
                        event.preventDefault();
                        onSelect(section);
                    },
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

/**
 * One section of the page: the place its entry of the navigation leads to.
 * Its cards are the named regions; the section itself adds no landmark.
 */
export function SettingsSection({
    id,
    children,
}: {
    id: SettingsSectionId;
    children: ReactNode;
}): ReactElement {
    return (
        <div
            id={id}
            data-slot="settings-section"
            tabIndex={-1}
            className="flex min-w-0 scroll-mt-20 flex-col gap-10 outline-none"
        >
            {children}
        </div>
    );
}
