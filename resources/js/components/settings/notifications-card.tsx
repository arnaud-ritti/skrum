import { useForm } from '@inertiajs/react';
import type { ReactElement } from 'react';
import NotificationPreferencesController from '@/actions/App/Http/Controllers/Settings/NotificationPreferencesController';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTrans } from '@/hooks/use-trans';

export type NotificationPreferences = {
    action_item_reminders_by_email: boolean;
    action_item_reminders_in_app: boolean;
    recap_emails: boolean;
    recap_in_app: boolean;
};

type NotificationChannel = {
    id: string;
    field: keyof NotificationPreferences;
    /** Accessible name of the switch: the cell shows the switch alone. */
    label: string;
};

/** One event of the table. An event without a channel leaves that cell empty. */
type NotificationRow = {
    key: string;
    event: string;
    description?: string;
    inApp?: NotificationChannel;
    email?: NotificationChannel;
};

type NotificationsCardProps = {
    preferences: NotificationPreferences;
    reminderTime: string;
    remindersEnabled: boolean;
    /** The events of the table; the two events of today when absent. */
    rows?: NotificationRow[];
};

const channelHead = 'w-16 px-3 text-center sm:w-26 sm:px-5';
const channelCell = 'w-16 px-3 py-3 text-center sm:w-26 sm:px-5';

export function NotificationsCard({
    preferences,
    reminderTime,
    remindersEnabled,
    rows,
}: NotificationsCardProps): ReactElement {
    const { t } = useTrans();
    const form = useForm<NotificationPreferences>(preferences);

    const events: NotificationRow[] = rows ?? [
        {
            key: 'action-item-reminders',
            event: t('Action item reminders'),
            description: t(
                'Reminders are sent at :time for action items assigned to you.',
                { time: reminderTime },
            ),
            inApp: {
                id: 'action-item-reminders-in-app',
                field: 'action_item_reminders_in_app',
                label: t(
                    'Show due and overdue action items in the notification bell',
                ),
            },
            email: {
                id: 'action-item-reminders-by-email',
                field: 'action_item_reminders_by_email',
                label: t('Email me about due and overdue action items'),
            },
        },
        {
            key: 'retro-recap',
            event: t('Retro recap'),
            inApp: {
                id: 'recap-in-app',
                field: 'recap_in_app',
                label: t('Show retro recaps in the notification bell'),
            },
            email: {
                id: 'recap-emails',
                field: 'recap_emails',
                label: t('Email me the results of retrospectives'),
            },
        },
    ];

    const channel = (cell?: NotificationChannel): ReactElement => (
        <TableCell className={channelCell}>
            {cell !== undefined && (
                <Switch
                    id={cell.id}
                    aria-label={cell.label}
                    checked={form.data[cell.field]}
                    onCheckedChange={(checked) =>
                        form.setData(cell.field, checked)
                    }
                    className="align-middle"
                />
            )}
        </TableCell>
    );

    return (
        <form
            data-slot="notifications-card"
            className="min-w-0"
            onSubmit={(event) => {
                event.preventDefault();
                form.submit(NotificationPreferencesController.update(), {
                    preserveScroll: true,
                });
            }}
        >
            <SettingsCard
                title={t('Notifications')}
                description={t('Choose what reaches you, and where.')}
                flush
                footer={
                    <LoadingButton
                        type="submit"
                        size="sm"
                        loading={form.processing}
                        className="max-w-full"
                    >
                        <span className="truncate">{t('Save')}</span>
                    </LoadingButton>
                }
            >
                {!remindersEnabled && (
                    <div className="border-b p-5">
                        <Alert
                            variant="info"
                            title={t(
                                'Reminders are turned off on this instance.',
                            )}
                        />
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="px-5">{t('Event')}</TableHead>
                            <TableHead className={channelHead}>
                                {t('In-app')}
                            </TableHead>
                            <TableHead className={channelHead}>
                                {t('Email')}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((row) => (
                            <TableRow
                                key={row.key}
                                className="hover:bg-transparent"
                            >
                                <th
                                    scope="row"
                                    className="px-5 py-3 text-left align-middle font-normal"
                                >
                                    <span className="block text-sm">
                                        {row.event}
                                    </span>
                                    {row.description !== undefined && (
                                        <span className="block text-xs text-muted-foreground">
                                            {row.description}
                                        </span>
                                    )}
                                </th>
                                {channel(row.inApp)}
                                {channel(row.email)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </SettingsCard>
        </form>
    );
}
