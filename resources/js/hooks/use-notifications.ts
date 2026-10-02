import { router, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import NotificationsController from '@/actions/App/Http/Controllers/NotificationsController';
import ReadAllNotificationsController from '@/actions/App/Http/Controllers/ReadAllNotificationsController';
import type { AppNotification } from '@/components/skrum/notifications-panel';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';

const SharedCounts = ['notifications', 'actionItems'];

/** How long the bell shows that a notification just arrived. */
const ArrivalMs = 4000;

type NotificationsPage = {
    notifications: AppNotification[];
    unreadCount: number;
    hasMore: boolean;
};

function refreshCounts(): void {
    router.reload({ only: SharedCounts });
}

function destination(notification: AppNotification): string {
    if ('actionItem' in notification) {
        return notification.actionItem.url;
    }

    return notification.href;
}

/**
 * `front` followed by what `back` adds to it. Items keep their id, so a
 * first page read again leaves the item under the pointer where it is.
 */
function merged(
    front: AppNotification[],
    back: AppNotification[],
): AppNotification[] {
    const known = new Set(front.map((notification) => notification.id));

    return [
        ...front,
        ...back.filter((notification) => !known.has(notification.id)),
    ];
}

export function useNotifications() {
    const { t } = useTrans();
    const { notifications: shared, auth } = usePage().props;
    const userId = shared ? auth?.user?.id : undefined;
    const sharedCount = shared?.unreadCount ?? 0;
    const [unreadCount, setUnreadCount] = useState(sharedCount);
    const [knownShared, setKnownShared] = useState(sharedCount);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const [arriving, setArriving] = useState(false);
    const latestLoad = useRef(0);
    const loadingMore = useRef(false);
    const watching = useRef(false);
    const refresh = useRef<() => void>(() => {});

    if (knownShared !== sharedCount) {
        setKnownShared(sharedCount);
        setUnreadCount(sharedCount);
    }

    useEffect(() => {
        window.addEventListener('focus', refreshCounts);

        return () => window.removeEventListener('focus', refreshCounts);
    }, []);

    const fetchFirstPage = async (keepOlderPages: boolean): Promise<void> => {
        const requestId = ++latestLoad.current;

        if (!keepOlderPages) {
            setLoading(true);
            setFailed(false);
        }

        try {
            const response = await retroRequest<NotificationsPage>(
                NotificationsController.index(),
            );

            if (requestId !== latestLoad.current) {
                return;
            }

            setNotifications((current) =>
                keepOlderPages
                    ? merged(response.notifications, current)
                    : response.notifications,
            );
            setHasMore((current) =>
                keepOlderPages && current ? current : response.hasMore === true,
            );
            setUnreadCount(response.unreadCount);
            setHasLoaded(true);
            setFailed(false);
        } catch {
            if (requestId === latestLoad.current && !keepOlderPages) {
                setFailed(true);
            }
        } finally {
            if (requestId === latestLoad.current) {
                setLoading(false);
            }
        }
    };

    refresh.current = () => {
        if (watching.current) {
            void fetchFirstPage(true);
        }
    };

    useEffect(() => {
        if (userId === undefined || !echoIsConfigured()) {
            return;
        }

        const name = `user.${userId}`;
        let settle: ReturnType<typeof setTimeout> | null = null;

        echo<'reverb'>()
            .private(name)
            .listen(
                '.notification.received',
                (payload: { unreadCount?: number }) => {
                    if (typeof payload.unreadCount === 'number') {
                        setUnreadCount(payload.unreadCount);
                    }

                    setArriving(true);

                    if (settle !== null) {
                        clearTimeout(settle);
                    }

                    settle = setTimeout(() => setArriving(false), ArrivalMs);
                    refresh.current();
                },
            );

        return () => {
            if (settle !== null) {
                clearTimeout(settle);
            }

            echo().leave(name);
        };
    }, [userId]);

    /** The panel opened: the list is read again from its first page. */
    const load = (): Promise<void> => {
        watching.current = true;
        setArriving(false);

        return fetchFirstPage(false);
    };

    /** The panel closed: an arrival no longer reloads the list. */
    const stopWatching = (): void => {
        watching.current = false;
    };

    const loadMore = async (): Promise<void> => {
        const last = notifications.at(-1);

        if (last === undefined || !hasMore || loadingMore.current) {
            return;
        }

        const requestId = latestLoad.current;

        loadingMore.current = true;

        try {
            const response = await retroRequest<NotificationsPage>(
                NotificationsController.index({ query: { before: last.id } }),
            );

            if (requestId !== latestLoad.current) {
                return;
            }

            setNotifications((current) =>
                merged(current, response.notifications),
            );
            setHasMore(response.hasMore === true);
            setUnreadCount(response.unreadCount);
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        } finally {
            loadingMore.current = false;
        }
    };

    const open = async (notification: AppNotification): Promise<void> => {
        if (notification.readAt === null) {
            try {
                const response = await retroRequest<{ unreadCount: number }>(
                    NotificationsController.update(notification.id),
                    { read: true },
                );

                setUnreadCount(response.unreadCount);
            } catch {
                // Visiting the destination matters more than the read mark.
            }
        }

        router.visit(destination(notification));
    };

    const markAllRead = async (): Promise<void> => {
        if (markingAllRead) {
            return;
        }

        setMarkingAllRead(true);

        try {
            await retroRequest(ReadAllNotificationsController.store());
            setUnreadCount(0);
            setNotifications((current) =>
                current.map((notification) => ({
                    ...notification,
                    readAt: notification.readAt ?? new Date().toISOString(),
                })),
            );
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        } finally {
            setMarkingAllRead(false);
        }
    };

    return {
        available: shared !== null && shared !== undefined,
        notifications,
        unreadCount,
        hasMore,
        loading: loading && !hasLoaded,
        failed,
        markingAllRead,
        arriving,
        load,
        loadMore,
        stopWatching,
        open,
        markAllRead,
    };
}
