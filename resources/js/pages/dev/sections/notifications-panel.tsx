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
            id: 's1',
            title: t('Sprint 42 retro'),
            facilitator: 'Inès B.',
            startsAt: '2026-10-01T11:50:00Z',
        },
    };
    const overdue: AppNotification = {
        id: 'n3',
        kind: 'overdue',
        wording: 'overdue',
        readAt: null,
        createdAt: '2026-10-01T08:00:00Z',
        actionItem: {
            id: 'a1',
            content: t('Isolate E2E data per worker'),
            teamName: t('Atlas'),
            dueOn: '2026-09-29',
            isOverdue: true,
            url: '#',
        },
    };
    const withTicket: AppNotification = {
        ...overdue,
        id: 'n3t',
        actionItem: { ...overdue.actionItem, ticket: 'ATLAS-1287' },
    };
    const dueSoon: AppNotification = {
        id: 'n3b',
        kind: 'due_soon',
        wording: 'due_tomorrow',
        readAt: null,
        createdAt: '2026-10-01T07:00:00Z',
        actionItem: {
            id: 'a2',
            content: t('Write the release notes'),
            teamName: t('Atlas'),
            dueOn: '2026-10-02',
            isOverdue: false,
            url: '#',
        },
    };
    const dueToday: AppNotification = {
        ...dueSoon,
        id: 'n3c',
        wording: 'due_today',
        readAt: '2026-10-01T09:00:00Z',
        actionItem: {
            ...dueSoon.actionItem,
            id: 'a3',
            content: t('Book the demo room'),
            dueOn: '2026-10-01',
        },
    };
    const extreme: AppNotification = {
        ...dueSoon,
        id: 'n3x',
        actionItem: {
            ...dueSoon.actionItem,
            id: 'a4',
            content: t(
                'Rewrite the onboarding checklist so that every new joiner gets access to the staging environment, the incident channel and the on-call calendar on their first morning, then review it with the three team leads before the next planning and archive the old wiki page for good.',
            ),
            teamName: t(
                'Platform reliability and developer experience guild (EMEA)',
            ),
        },
    };
    const many: AppNotification[] = Array.from({ length: 200 }, (_, index) => ({
        ...dueSoon,
        id: `many-${index}`,
        readAt: index < 12 ? null : '2026-10-01T09:00:00Z',
    }));
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
        team: t('Atlas'),
        session: { id: 's3', title: t('Sprint 41 retro') },
        actionsCount: 4,
        roti: 3.8,
        href: '#',
    };
    const recapWithoutRoti: AppNotification = {
        ...recap,
        id: 'n5b',
        readAt: null,
        actionsCount: 1,
        roti: null,
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
                        'Notifications the server sends today: overdue, due today, due tomorrow',
                    )}
                >
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            onInvite={undefined}
                            onJoin={undefined}
                            notifications={[overdue, dueSoon, dueToday]}
                            unreadCount={2}
                        />
                    </Frame>
                </Example>
                <Example
                    label={t(
                        'What the bell lists: invitation with its link, overdue action with its ticket, recap with and without ROTI',
                    )}
                >
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            onInvite={undefined}
                            onJoin={undefined}
                            notifications={[
                                invite,
                                withTicket,
                                recapWithoutRoti,
                                recap,
                            ]}
                            unreadCount={3}
                        />
                    </Frame>
                </Example>
                <Example label={t('No notification at all (0 items)')}>
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            notifications={[]}
                            unreadCount={0}
                        />
                    </Frame>
                </Example>
                <Example
                    label={t(
                        'One notification, 280-character action, 60-character team',
                    )}
                >
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            notifications={[extreme]}
                            unreadCount={1}
                        />
                    </Frame>
                </Example>
                <Example label={t('200 notifications, the list scrolls')}>
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            notifications={many}
                            unreadCount={12}
                        />
                    </Frame>
                </Example>
                <Example label={t('Load failed, with retry')}>
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            failed
                            onRetry={() => undefined}
                        />
                    </Frame>
                </Example>
                <Example
                    label={t(
                        'Backlog kinds without handlers: no Accept, Decline or Join',
                    )}
                >
                    <Frame>
                        <NotificationsPanel
                            {...base}
                            onInvite={undefined}
                            onJoin={undefined}
                            notifications={[invite, starting, withTicket]}
                        />
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
