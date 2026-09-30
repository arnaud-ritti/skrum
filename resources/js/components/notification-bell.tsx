import { router, usePage } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
    const [failed, setFailed] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const latestLoad = useRef(0);

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
        const requestId = ++latestLoad.current;

        setFailed(false);

        try {
            const response = await retroRequest<{
                notifications: BellNotification[];
                unreadCount: number;
            }>(NotificationsController.index());

            if (requestId !== latestLoad.current) {
                return;
            }

            setItems(response.notifications);
            setUnread(response.unreadCount);
            setLoadedAt(Date.now());
        } catch {
            if (requestId === latestLoad.current) {
                setFailed(true);
            }
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
        if (markingAll) {
            return;
        }

        setMarkingAll(true);

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
        } finally {
            setMarkingAll(false);
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
                    aria-label={
                        unread === 1
                            ? t(':count unread notification', {
                                  count: unread,
                              })
                            : unread > 1
                              ? t(':count unread notifications', {
                                    count: unread,
                                })
                              : t('Notifications')
                    }
                >
                    <Bell className="size-5" />
                    {unread > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
                        >
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                    {t('Notifications')}
                </DropdownMenuLabel>
                <DropdownMenuItem
                    disabled={unread === 0 || markingAll}
                    onSelect={(event) => {
                        event.preventDefault();
                        void readAll();
                    }}
                >
                    {t('Mark all as read')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {items === null && failed && (
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                        <span>{t('Could not load the notifications.')}</span>
                        <DropdownMenuItem
                            onSelect={(event) => {
                                event.preventDefault();
                                void load();
                            }}
                        >
                            {t('Retry')}
                        </DropdownMenuItem>
                    </div>
                )}
                {items === null && !failed && (
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
