import { usePage } from '@inertiajs/react';
import { Bell, KeyRound, Palette, Shield, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { SettingsFrame } from '@/components/skrum/frames';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
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
            <SettingsFrame
                title={t('Settings')}
                navLabel={t('Settings')}
                description={t('Your account, applied in every workspace')}
                stuckNav
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
            </SettingsFrame>
        </AppLayout>
    );
}

/**
 * One section of the page: the place its entry of the navigation leads to,
 * named like that entry for the reader who lands on it. Its cards are the
 * named regions; the section itself adds no landmark.
 */
export function SettingsSection({
    id,
    children,
}: {
    id: SettingsSectionId;
    children: ReactNode;
}): ReactElement {
    const labels = useSettingsSectionLabels();

    return (
        <div
            id={id}
            role="group"
            aria-label={labels[id]}
            data-slot="settings-section"
            tabIndex={-1}
            className="flex min-w-0 scroll-mt-27 flex-col gap-10 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:scroll-mt-20"
        >
            {children}
        </div>
    );
}
