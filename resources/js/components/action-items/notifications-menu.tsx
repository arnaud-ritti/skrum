import { usePage } from '@inertiajs/react';
import { useId, useState } from 'react';
import {
    NotificationsBell,
    NotificationsPanel,
} from '@/components/skrum/notifications-panel';
import type { NotificationsTab } from '@/components/skrum/notifications-panel';
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useMinWidth } from '@/hooks/use-min-width';
import { useNotifications } from '@/hooks/use-notifications';
import { useTrans } from '@/hooks/use-trans';
import { edit as notificationSettings } from '@/routes/notificationPreferences';

/** Under this width the panel is a drawer (NotificationsPanel README). */
const PopoverMinWidthPx = 640;

/**
 * The bell of the topbar. An invitation links to its page, so the panel is
 * given no `onInvite`; a request to join a team is answered from here.
 */
export function NotificationsMenu() {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const model = useNotifications();
    const titleId = useId();
    const isWide = useMinWidth(PopoverMinWidthPx);
    const [isOpen, setIsOpen] = useState(false);
    const [tab, setTab] = useState<NotificationsTab>('all');

    if (!model.available) {
        return null;
    }

    const onOpenChange = (next: boolean): void => {
        setIsOpen(next);

        if (!next) {
            model.stopWatching();

            return;
        }

        void model.load();
    };

    const bell = (
        <NotificationsBell
            unreadCount={model.unreadCount}
            open={isOpen}
            arriving={model.arriving}
            announcement={model.arriving ? t('New notification') : undefined}
        />
    );

    const panel = (
        <NotificationsPanel
            notifications={model.notifications}
            unreadCount={model.unreadCount}
            tab={tab}
            onTabChange={setTab}
            onMarkAllRead={() => void model.markAllRead()}
            onOpen={(notification) => {
                onOpenChange(false);
                void model.open(notification);
            }}
            onAccessRequest={(notification, decision) =>
                void model.answerAccessRequest(notification, decision)
            }
            settingsHref={notificationSettings.url()}
            failed={model.failed}
            onRetry={() => void model.load()}
            markingAllRead={model.markingAllRead}
            hasMore={model.hasMore}
            onLoadMore={() => void model.loadMore()}
            loading={model.loading}
            locale={typeof locale === 'string' ? locale : undefined}
            titleId={isWide ? titleId : undefined}
        />
    );

    /** Tells a browser test when an arrival can reach the bell without a reload. */
    const channelState = (
        <span
            hidden
            data-notifications-channel={
                model.subscribed ? 'subscribed' : 'subscribing'
            }
        />
    );

    if (!isWide) {
        return (
            <>
                {channelState}
                <Drawer open={isOpen} onOpenChange={onOpenChange}>
                    <DrawerTrigger asChild>{bell}</DrawerTrigger>
                    <DrawerContent
                        showCloseButton={false}
                        aria-describedby={undefined}
                        className="px-0"
                    >
                        <DrawerTitle className="sr-only">
                            {t('Notifications')}
                        </DrawerTitle>
                        <div className="flex min-h-0 flex-col overflow-y-auto">
                            {panel}
                        </div>
                    </DrawerContent>
                </Drawer>
            </>
        );
    }

    return (
        <>
            {channelState}
            <Popover open={isOpen} onOpenChange={onOpenChange}>
                <PopoverTrigger asChild>{bell}</PopoverTrigger>
                <PopoverContent
                    align="end"
                    aria-labelledby={titleId}
                    className="w-100 max-w-100 overflow-hidden p-0"
                    onOpenAutoFocus={(event) => {
                        const activeTab = (
                            event.currentTarget as HTMLElement | null
                        )?.querySelector<HTMLElement>(
                            '[role="tab"][aria-selected="true"]',
                        );

                        if (activeTab) {
                            event.preventDefault();
                            activeTab.focus();
                        }
                    }}
                >
                    {panel}
                </PopoverContent>
            </Popover>
        </>
    );
}
