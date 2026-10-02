import { Head } from '@inertiajs/react';
import { NotificationsCard } from '@/components/settings/notifications-card';
import type { NotificationPreferences } from '@/components/settings/notifications-card';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    preferences: NotificationPreferences;
    reminderTime: string;
    remindersEnabled: boolean;
};

export default function NotificationSettings({
    preferences,
    reminderTime,
    remindersEnabled,
}: Props) {
    const { t } = useTrans();

    return (
        <SettingsShell active="notifications">
            <Head title={t('Notification settings')} />

            <NotificationsCard
                preferences={preferences}
                reminderTime={reminderTime}
                remindersEnabled={remindersEnabled}
            />
        </SettingsShell>
    );
}
