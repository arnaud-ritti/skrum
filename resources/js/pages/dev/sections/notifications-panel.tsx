import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    NotificationsBell,
    NotificationsPanel,
} from '@/components/skrum/notifications-panel';
import type {
    AppNotification,
    NotificationsPanelProps,
    NotificationsTab,
} from '@/components/skrum/notifications-panel';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const now = new Date('2026-10-01T12:00:00Z').getTime();

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Frame({
    children,
    narrow = false,
}: {
    children: ReactNode;
    narrow?: boolean;
}) {
    return (
        <div
            className={
                narrow
                    ? 'w-full max-w-97.5 overflow-hidden rounded-2xl border bg-popover shadow-popover'
                    : 'w-full max-w-100 overflow-hidden rounded-lg border bg-popover shadow-popover'
            }
        >
            {children}
        </div>
    );
}

export default function NotificationsPanelSection() {
    const { t } = useTrans();
    const [tab, setTab] = useState<NotificationsTab>('all');

    const invite: AppNotification = {
        id: 'n1',
        kind: 'team_invite',
        readAt: null,
        createdAt: '2026-10-01T11:58:00Z',
        actor: { name: 'Camille R.', presence: 5 },
        team: t('Atlas'),
        href: '#',
    };
    const answered: AppNotification = {
        ...invite,
        id: 'n1b',
        answer: 'accepted',
    };
    const declined: AppNotification = {
        ...invite,
        id: 'n1c',
        answer: 'declined',
    };
    const starting: AppNotification = {
        id: 'n2',
        kind: 'session_starting',
        readAt: null,
        createdAt: '2026-10-01T11:55:00Z',
        session: {
            id: 's1',
            title: t('Sprint 42 retro'),
            startsAt: '2026-10-01T12:05:00Z',
            facilitator: 'Inès B.',
        },
        href: '#',
    };
    const started: AppNotification = {
        ...starting,
        id: 'n2b',
        session: {
            ...starting.session!,
            startsAt: '2026-10-01T11:50:00Z',
        },
    };
    const overdue: AppNotification = {
        id: 'n3',
        kind: 'action_overdue',
        readAt: null,
        createdAt: '2026-10-01T08:00:00Z',
        action: {
            id: 'a1',
            title: t('Isolate E2E data per worker'),
            dueAt: '2026-09-29T00:00:00Z',
            ticket: 'ATLAS-1287',
        },
        href: '#',
    };
    const dueSoon: AppNotification = {
        id: 'n3b',
        kind: 'action_due_soon',
        readAt: null,
        createdAt: '2026-10-01T07:00:00Z',
        action: {
            id: 'a2',
            title: t('Write the release notes'),
            dueAt: '2026-10-02T00:00:00Z',
        },
        href: '#',
    };
    const mention: AppNotification = {
        id: 'n4',
        kind: 'mention',
        readAt: '2026-10-01T11:30:00Z',
        createdAt: '2026-10-01T11:00:00Z',
        actor: { name: 'Théo M.', presence: 2 },
        excerpt: t('@Arnaud can you look at the flaky checkout test?'),
        session: {
            id: 's2',
            title: t('Sprint 42 retro'),
            startsAt: '2026-10-01T10:00:00Z',
            facilitator: 'Inès B.',
        },
        href: '#',
    };
    const grouped: AppNotification = {
        ...mention,
        id: 'n4b',
        actor: { name: 'Théo M.', presence: 2, others: 2 },
    };
    const recap: AppNotification = {
        id: 'n5',
        kind: 'recap_ready',
        readAt: '2026-09-30T12:00:00Z',
        createdAt: '2026-09-30T12:00:00Z',
        session: {
            id: 's3',
            title: t('Sprint 41 retro'),
            startsAt: '2026-09-30T10:00:00Z',
            facilitator: 'Inès B.',
            ended: true,
        },
        href: '#',
    };

    const all = [invite, starting, overdue, mention, recap];
    const base: NotificationsPanelProps = {
        notifications: all,
        unreadCount: 3,
        tab: 'all',
        onTabChange: () => undefined,
        onMarkAllRead: () => undefined,
        onOpen: () => undefined,
        onInvite: () => undefined,
        onJoin: () => undefined,
        settingsHref: '#',
        now,
    };

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Bell: none, count, 9+, open, new arrival')}>
                <div className="flex flex-wrap items-center gap-6">
                    <NotificationsBell unreadCount={0} />
                    <NotificationsBell unreadCount={3} />
                    <NotificationsBell unreadCount={12} />
                    <NotificationsBell unreadCount={3} open />
                    <NotificationsBell
                        unreadCount={4}
                        arriving
                        announcement={t(
                            'New notification: Sprint 42 retro starts in 5 min',
                        )}
                    />
                </div>
            </Example>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),25rem))] items-start gap-8">
                <Example
                    label={t(
                        'All tab: invitation, session, overdue action, mention, recap',
                    )}
                >
                    <Frame>
                        <NotificationsPanel {...base} />
                    </Frame>
                </Example>
                <Example
                    label={t(
                        'Interactive: switch tabs (Unread filters the list)',
                    )}
                >
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            tab={tab}
                            onTabChange={setTab}
                            hasMore
                            onLoadMore={() => undefined}
                        />
                    </Frame>
                </Example>
                <Example
                    label={t(
                        'Unread tab: empty state, mark all as read disabled',
                    )}
                >
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            tab="unread"
                            notifications={[recap]}
                            unreadCount={0}
                        />
                    </Frame>
                </Example>
                <Example label={t('Loading: three skeleton items')}>
                    <Frame>
                        <NotificationsPanel {...base} loading />
                    </Frame>
                </Example>
                <Example
                    label={t(
                        'Invitation answered (accepted, declined), session started, due soon',
                    )}
                >
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            notifications={[
                                answered,
                                declined,
                                started,
                                dueSoon,
                            ]}
                        />
                    </Frame>
                </Example>
                <Example label={t('Grouped mention with quote, read item')}>
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            notifications={[grouped, recap]}
                            unreadCount={0}
                        />
                    </Frame>
                </Example>
                <Example label={t('Mobile: Drawer content, 390px')}>
                    <Frame narrow>
                        <NotificationsPanel
                            {...base}
                            notifications={[starting, overdue, mention]}
                        />
                    </Frame>
                </Example>
                <Example label={t('Narrow container, 20rem')}>
                    <div className="w-80 max-w-full overflow-hidden rounded-lg border bg-popover shadow-popover">
                        <NotificationsPanel
                            {...base}
                            notifications={[invite, starting]}
                        />
                    </div>
                </Example>
            </div>
        </div>
    );
}
