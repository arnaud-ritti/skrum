import { router, usePage } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import NotificationsController from '@/actions/App/Http/Controllers/NotificationsController';
import ReadAllNotificationsController from '@/actions/App/Http/Controllers/ReadAllNotificationsController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { retroRequest } from '@/lib/retro/api';

type Wording = 'overdue' | 'due_today' | 'due_tomorrow';

type BellNotification = {
    id: string;
    kind: 'due_soon' | 'overdue';
    wording: Wording;
    readAt: string | null;
    createdAt: string;
    actionItem: {
        id: string;
        content: string;
        teamName: string;
        dueOn: string | null;
        isOverdue: boolean;
        url: string;
    };
};

/** Translation keys, passed to t() through a variable. */
const WordingLabels: Record<Wording, string> = {
    overdue: 'Overdue: :content',
    due_today: 'Due today: :content',
    due_tomorrow: 'Due tomorrow: :content',
};

const SharedCounts = ['notifications', 'actionItems'];

function refreshCounts() {
    router.reload({ only: SharedCounts });
}

export function NotificationBell() {
    const { t } = useTrans();
    const { notifications, locale } = usePage().props;
    const shared = notifications?.unreadCount ?? 0;
    const [unread, setUnread] = useState(shared);
    const [knownShared, setKnownShared] = useState(shared);
    const [items, setItems] = useState<BellNotification[] | null>(null);
    const [loadedAt, setLoadedAt] = useState(0);

    if (knownShared !== shared) {
        setKnownShared(shared);
        setUnread(shared);
    }

    useEffect(() => {
        window.addEventListener('focus', refreshCounts);

        return () => window.removeEventListener('focus', refreshCounts);
    }, []);

    if (notifications === null) {
        return null;
    }

    const load = async () => {
        try {
            const response = await retroRequest<{
                notifications: BellNotification[];
                unreadCount: number;
            }>(NotificationsController.index());

            setItems(response.notifications);
            setUnread(response.unreadCount);
            setLoadedAt(Date.now());
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    const open = async (notification: BellNotification) => {
        if (notification.readAt === null) {
            try {
                const response = await retroRequest<{ unreadCount: number }>(
                    NotificationsController.update(notification.id),
                    { read: true },
                );

                setUnread(response.unreadCount);
            } catch {
                // Visiting the item matters more than the read mark.
            }
        }

        router.visit(notification.actionItem.url);
    };

    const readAll = async () => {
        try {
            await retroRequest(ReadAllNotificationsController.store());
            setUnread(0);
            setItems(
                (current) =>
                    current?.map((notification) => ({
                        ...notification,
                        readAt: notification.readAt ?? new Date().toISOString(),
                    })) ?? null,
            );
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <DropdownMenu
            onOpenChange={(isOpen) => {
                if (isOpen) {
                    void load();
                }
            }}
        >
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={t('Notifications')}
                >
                    <Bell className="size-5" />
                    {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                    {t('Notifications')}
                    <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        disabled={unread === 0}
                        onClick={() => void readAll()}
                    >
                        {t('Mark all as read')}
                    </Button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items === null && (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t('Loading…')}
                    </p>
                )}
                {items?.length === 0 && (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t('No notifications.')}
                    </p>
                )}
                {items?.map((notification) => (
                    <DropdownMenuItem
                        key={notification.id}
                        className="flex flex-col items-start gap-0.5"
                        onSelect={() => void open(notification)}
                    >
                        <span
                            className={`break-words ${notification.readAt === null ? 'font-semibold' : ''}`}
                        >
                            {t(WordingLabels[notification.wording], {
                                content: notification.actionItem.content,
                            })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {notification.actionItem.teamName} ·{' '}
                            {formatRelativeTime(
                                notification.createdAt,
                                locale,
                                loadedAt,
                            )}
                        </span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
