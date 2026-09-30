import { Head, useForm } from '@inertiajs/react';
import NotificationPreferencesController from '@/actions/App/Http/Controllers/Settings/NotificationPreferencesController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { edit as editNotifications } from '@/routes/notificationPreferences';

type Preferences = {
    action_item_reminders_by_email: boolean;
    action_item_reminders_in_app: boolean;
};

type Props = {
    preferences: Preferences;
    reminderTime: string;
    remindersEnabled: boolean;
};

export default function NotificationSettings({
    preferences,
    reminderTime,
    remindersEnabled,
}: Props) {
    const { t } = useTrans();
    const form = useForm<Preferences>(preferences);

    return (
        <>
            <Head title={t('Notification settings')} />

            <h1 className="sr-only">{t('Notification settings')}</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={t('Action item reminders')}
                    description={t(
                        'Reminders are sent at :time for action items assigned to you.',
                        { time: reminderTime },
                    )}
                />

                {!remindersEnabled && (
                    <p className="text-sm text-muted-foreground">
                        {t('Reminders are turned off on this instance.')}
                    </p>
                )}

                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.submit(
                            NotificationPreferencesController.update(),
                            {
                                preserveScroll: true,
                            },
                        );
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="action-item-reminders-by-email"
                            checked={form.data.action_item_reminders_by_email}
                            onCheckedChange={(checked) =>
                                form.setData(
                                    'action_item_reminders_by_email',
                                    checked === true,
                                )
                            }
                        />
                        <Label htmlFor="action-item-reminders-by-email">
                            {t('Email me about due and overdue action items')}
                        </Label>
                    </div>
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="action-item-reminders-in-app"
                            checked={form.data.action_item_reminders_in_app}
                            onCheckedChange={(checked) =>
                                form.setData(
                                    'action_item_reminders_in_app',
                                    checked === true,
                                )
                            }
                        />
                        <Label htmlFor="action-item-reminders-in-app">
                            {t(
                                'Show due and overdue action items in the notification bell',
                            )}
                        </Label>
                    </div>
                    <Button disabled={form.processing}>{t('Save')}</Button>
                </form>
            </div>
        </>
    );
}

NotificationSettings.layout = {
    breadcrumbs: [
        {
            title: 'Notification settings',
            href: editNotifications(),
        },
    ],
};
