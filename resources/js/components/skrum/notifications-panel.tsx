import { Link } from '@inertiajs/react';
import {
    Bell,
    BellRing,
    CalendarClock,
    CheckCheck,
    ChevronRight,
    FileText,
    LogIn,
    Radio,
    RefreshCw,
    Settings,
} from 'lucide-react';
import { Fragment, useId, useState } from 'react';
import type {
    ComponentProps,
    KeyboardEvent,
    MouseEvent,
    ReactNode,
} from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** The in-app notifications the server sends (`ActionItemReminderNotification`). */
export type ActionItemNotificationKind = 'due_soon' | 'overdue';

/**
 * Backlog: no in-app notification of these kinds exists on the server. They
 * render when given; their buttons need the matching optional callback.
 */
export type BacklogNotificationKind =
    | 'team_invite'
    | 'session_starting'
    | 'mention'
    | 'recap_ready';

export type NotificationKind =
    | ActionItemNotificationKind
    | BacklogNotificationKind;

export type NotificationWording = 'overdue' | 'due_today' | 'due_tomorrow';

export type NotificationPresence =
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12;

export type NotificationsTab = 'all' | 'unread';

type NotificationBase = {
    id: string;
    readAt: string | null;
    createdAt: string;
};

/** Same shape as the payload of `NotificationsController@index`. */
export type ActionItemNotification = NotificationBase & {
    kind: ActionItemNotificationKind;
    wording: NotificationWording;
    actionItem: {
        id: string;
        content: string;
        teamName: string;
        dueOn: string | null;
        isOverdue: boolean;
        url: string;
        /** Backlog: key of the linked ticket. */
        ticket?: string;
    };
};

export type BacklogNotification = NotificationBase & {
    kind: BacklogNotificationKind;
    actor?: {
        name: string;
        presence: NotificationPresence;
        avatarUrl?: string;
        others?: number;
    };
    team?: string;
    session?: {
        id: string;
        title: string;
        startsAt: string;
        facilitator: string;
        ended?: boolean;
    };
    excerpt?: string;
    answer?: 'accepted' | 'declined';
    href: string;
};

export type AppNotification = ActionItemNotification | BacklogNotification;

function isActionItemNotification(
    notification: AppNotification,
): notification is ActionItemNotification {
    return notification.kind === 'due_soon' || notification.kind === 'overdue';
}

export type NotificationsPanelProps = {
    notifications: AppNotification[];
    unreadCount: number;
    tab: NotificationsTab;
    onTabChange: (tab: NotificationsTab) => void;
    onMarkAllRead: () => void;
    onOpen: (notification: AppNotification) => void;
    /** Backlog: Accept / Decline are rendered only when given. */
    onInvite?: (id: string, answer: 'accept' | 'decline') => void;
    /** Backlog: Join is rendered only when given. */
    onJoin?: (sessionId: string) => void;
    settingsHref: string;
    /** The list could not be loaded; Retry is rendered with `onRetry`. */
    failed?: boolean;
    onRetry?: () => void;
    /** A "mark all as read" request is running. */
    markingAllRead?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    loading?: boolean;
    totalCount?: number;
    locale?: string;
    now?: number;
    titleId?: string;
    className?: string;
};

type RichValues = Record<string, ReactNode>;

function Rich({ template, values }: { template: string; values: RichValues }) {
    const parts = template.split(/(:[a-z]+)/);

    return (
        <>
            {parts.map((part, index) => {
                const value = part.startsWith(':')
                    ? values[part.slice(1)]
                    : undefined;

                if (value === undefined) {
                    return part;
                }

                return (
                    <b key={index} className="font-semibold">
                        {value}
                    </b>
                );
            })}
        </>
    );
}

function relativeTime(iso: string, now: number, locale?: string): string {
    const elapsed = new Date(iso).getTime() - now;
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ['day', 86_400_000],
        ['hour', 3_600_000],
        ['minute', 60_000],
    ];

    for (const [unit, size] of units) {
        if (Math.abs(elapsed) >= size) {
            return formatter.format(Math.round(elapsed / size), unit);
        }
    }

    return formatter.format(0, 'minute');
}

function shortDate(iso: string, locale?: string): string {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: isDateOnly ? 'UTC' : undefined,
    }).format(new Date(iso));
}

function shortTime(iso: string, locale?: string): string {
    return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
        new Date(iso),
    );
}

const tileClasses = {
    primary: 'bg-skrum-primary-soft text-skrum-primary-text',
    destructive: 'bg-skrum-destructive-soft text-skrum-destructive-text',
    muted: 'bg-muted text-muted-foreground',
};

function Tile({
    tone,
    children,
}: {
    tone: keyof typeof tileClasses;
    children: ReactNode;
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'grid size-8 shrink-0 place-items-center rounded-md [&_svg]:size-4',
                tileClasses[tone],
            )}
        >
            {children}
        </span>
    );
}

type ItemProps = {
    notification: AppNotification;
    now: number;
    locale?: string;
    onOpen: (notification: AppNotification) => void;
    onInvite: NotificationsPanelProps['onInvite'];
    onJoin: NotificationsPanelProps['onJoin'];
};

const stretchedLink =
    "outline-none after:absolute after:inset-0 after:rounded-sm after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring";

function NotificationItem({
    notification,
    now,
    locale,
    onOpen,
    onInvite,
    onJoin,
}: ItemProps) {
    const { t } = useTrans();
    const { kind } = notification;
    const actionNotification = isActionItemNotification(notification)
        ? notification
        : null;
    const backlog = isActionItemNotification(notification)
        ? null
        : notification;
    const actor = backlog?.actor;
    const session = backlog?.session;
    const href = actionNotification?.actionItem.url ?? backlog?.href ?? '#';
    const isUnread = notification.readAt === null;
    const relative = relativeTime(notification.createdAt, now, locale);
    const actorName = actor?.name ?? t('Someone');

    const open = (event: MouseEvent<HTMLAnchorElement>) => {
        if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        event.preventDefault();
        onOpen(notification);
    };

    let leading: ReactNode = (
        <Tile tone="muted">
            <FileText />
        </Tile>
    );
    let text: ReactNode = null;
    let meta: ReactNode = relative;
    let quote: ReactNode = null;
    let actions: ReactNode = null;
    let linkLabel: string | null = null;

    if (actor) {
        leading = (
            <PersonAvatar
                decorative
                name={actor.name}
                presence={actor.presence}
                src={actor.avatarUrl}
            />
        );
    }

    if (kind === 'team_invite') {
        text = (
            <Rich
                template={t(':actor invited you to join team :team')}
                values={{
                    actor: actorName,
                    team: backlog?.team ?? '',
                }}
            />
        );

        if (backlog?.answer === 'accepted') {
            meta = (
                <>
                    {t('Accepted · welcome to :team', {
                        team: backlog.team ?? '',
                    })}
                </>
            );
        } else if (backlog?.answer === 'declined') {
            meta = <>{t('Declined')}</>;
        } else if (onInvite) {
            actions = (
                <>
                    <Button
                        size="sm"
                        className="max-w-full"
                        onClick={() => onInvite(notification.id, 'accept')}
                    >
                        <span className="truncate">{t('Accept')}</span>
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="max-w-full"
                        onClick={() => onInvite(notification.id, 'decline')}
                    >
                        <span className="truncate">{t('Decline')}</span>
                    </Button>
                </>
            );
        }
    }

    if (kind === 'session_starting' && session) {
        const minutes = Math.ceil(
            (new Date(session.startsAt).getTime() - now) / 60_000,
        );

        leading = (
            <Tile tone="primary">
                <Radio />
            </Tile>
        );
        text =
            minutes > 0 ? (
                <Rich
                    template={t(':session starts in :minutes min')}
                    values={{ session: session.title, minutes }}
                />
            ) : (
                <Rich
                    template={t(':session has started')}
                    values={{ session: session.title }}
                />
            );
        meta = `${t('Facilitated by :name', { name: session.facilitator })} · ${shortTime(session.startsAt, locale)}`;

        if (!session.ended && onJoin) {
            const sessionId = session.id;

            actions = (
                <Button
                    size="sm"
                    className="max-w-full"
                    onClick={() => onJoin(sessionId)}
                >
                    <LogIn aria-hidden="true" />
                    <span className="truncate">{t('Join')}</span>
                </Button>
            );
        }
    }

    if (actionNotification) {
        const { actionItem, wording } = actionNotification;
        const templates: Record<NotificationWording, string> = {
            overdue: t('Overdue: :content'),
            due_today: t('Due today: :content'),
            due_tomorrow: t('Due tomorrow: :content'),
        };
        const parts: { key: string; node: ReactNode }[] = [
            {
                key: 'team',
                node: (
                    <span className="min-w-0 break-words">
                        {actionItem.teamName}
                    </span>
                ),
            },
        ];

        if (actionItem.dueOn !== null) {
            parts.push({
                key: 'due',
                node: (
                    <span
                        className={cn(
                            actionItem.isOverdue &&
                                'font-semibold text-skrum-destructive-text',
                        )}
                    >
                        {t('Due :date', {
                            date: shortDate(actionItem.dueOn, locale),
                        })}
                    </span>
                ),
            });
        }

        if (actionItem.ticket) {
            parts.push({
                key: 'ticket',
                node: (
                    <span className="font-mono text-overline">
                        {actionItem.ticket}
                    </span>
                ),
            });
        }

        parts.push({ key: 'time', node: <span>{relative}</span> });

        leading = (
            <Tile tone={actionItem.isOverdue ? 'destructive' : 'primary'}>
                <CalendarClock />
            </Tile>
        );
        text = (
            <Rich
                template={templates[wording]}
                values={{ content: actionItem.content }}
            />
        );
        meta = parts.map((part, index) => (
            <Fragment key={part.key}>
                {index > 0 && <span aria-hidden="true">·</span>}
                {part.node}
            </Fragment>
        ));
    }

    if (kind === 'mention') {
        const others = actor?.others ?? 0;

        text =
            others > 0 ? (
                <Rich
                    template={t(
                        ':actor and :count others mentioned you on a card',
                    )}
                    values={{ actor: actorName, count: others }}
                />
            ) : (
                <Rich
                    template={t(':actor mentioned you on a card')}
                    values={{ actor: actorName }}
                />
            );

        if (backlog?.excerpt) {
            quote = (
                <blockquote className="my-1 rounded-sm border bg-background px-2 py-1.5 text-body-sm break-words text-foreground">
                    {backlog.excerpt}
                </blockquote>
            );
        }

        if (session) {
            meta = `${relative} · ${session.title}`;
        }
    }

    if (kind === 'recap_ready' && session) {
        text = (
            <Rich
                template={t('The recap of :session is ready')}
                values={{ session: session.title }}
            />
        );
        linkLabel = t('View recap');
    }

    const textClasses = cn(
        'text-body-sm break-words',
        isUnread ? 'text-foreground' : 'text-muted-foreground',
    );

    return (
        <li
            data-slot="notification-item"
            data-kind={kind}
            data-unread={isUnread}
            className="relative flex gap-3 border-t py-3 pr-8 pl-4 hover:bg-muted data-[unread=true]:bg-skrum-primary-soft/55 data-[unread=true]:hover:bg-muted"
        >
            {leading}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {linkLabel ? (
                    <p className={textClasses}>{text}</p>
                ) : (
                    <p className={textClasses}>
                        <a
                            data-notification-link
                            href={href}
                            onClick={open}
                            className={stretchedLink}
                        >
                            {text}
                        </a>
                    </p>
                )}
                {quote}
                <span className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                    {meta}
                </span>
                {actions ? (
                    <div className="relative z-10 mt-2 flex flex-wrap gap-2">
                        {actions}
                    </div>
                ) : null}
                {linkLabel ? (
                    <a
                        data-notification-link
                        href={href}
                        onClick={open}
                        className={cn(
                            stretchedLink,
                            'mt-1 self-start text-body-sm font-semibold text-skrum-primary-text underline-offset-4 hover:underline',
                        )}
                    >
                        {linkLabel}
                    </a>
                ) : null}
            </div>
            {isUnread ? (
                <>
                    <span className="sr-only">{t('Unread')}</span>
                    <span
                        aria-hidden="true"
                        className="absolute top-4.5 right-4 size-2 rounded-full bg-primary"
                    />
                </>
            ) : null}
        </li>
    );
}

function ItemsSkeleton() {
    return (
        <div aria-busy="true" data-slot="notifications-loading">
            {[0, 1, 2].map((index) => (
                <div key={index} className="flex gap-3 border-t py-3 pr-8 pl-4">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-2/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function NotificationsPanel({
    notifications,
    unreadCount,
    tab,
    onTabChange,
    onMarkAllRead,
    onOpen,
    onInvite,
    onJoin,
    settingsHref,
    failed = false,
    onRetry,
    markingAllRead = false,
    hasMore = false,
    onLoadMore,
    loading = false,
    totalCount,
    locale,
    now,
    titleId,
    className,
}: NotificationsPanelProps) {
    const { t } = useTrans();
    const generatedId = useId();
    const [mountedAt] = useState(() => Date.now());
    const headingId = titleId ?? generatedId;
    const reference = now ?? mountedAt;
    const resolvedLocale =
        locale ??
        (typeof document === 'undefined'
            ? undefined
            : document.documentElement.lang || undefined);
    const visible =
        tab === 'unread'
            ? notifications.filter(
                  (notification) => notification.readAt === null,
              )
            : notifications;

    const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
        }

        const links = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
                '[data-notification-link]',
            ),
        );
        const index = links.indexOf(document.activeElement as HTMLElement);

        if (index === -1) {
            return;
        }

        const next = links[index + (event.key === 'ArrowDown' ? 1 : -1)];

        if (!next) {
            return;
        }

        event.preventDefault();
        next.focus();
    };

    const cannotMarkAllRead = unreadCount === 0 || markingAllRead;
    const emptyTitle =
        tab === 'unread'
            ? t('You’re all caught up')
            : t('No notifications yet');
    const emptyDescription =
        tab === 'unread'
            ? t(
                  'No unread notifications. Invitations, reminders and mentions will show up here.',
              )
            : t('Invitations, reminders and mentions will show up here.');

    return (
        <div
            data-slot="notifications-panel"
            className={cn(
                'flex w-full min-w-0 flex-col overflow-hidden bg-popover text-popover-foreground',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2 pt-3 pr-3 pl-4">
                <h2
                    id={headingId}
                    className="truncate text-ui-lg font-semibold"
                >
                    {t('Notifications')}
                </h2>
                <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 text-skrum-primary-text aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                    aria-disabled={cannotMarkAllRead || undefined}
                    onClick={() => {
                        if (cannotMarkAllRead) {
                            return;
                        }

                        onMarkAllRead();
                    }}
                >
                    <CheckCheck aria-hidden="true" />
                    <span className="truncate">{t('Mark all as read')}</span>
                </Button>
            </div>
            <Tabs
                value={tab}
                onValueChange={onTabChange}
                aria-label={t('Notifications')}
                fullWidth
                className="gap-0"
                items={[
                    {
                        value: 'all' as const,
                        label: t('All'),
                        count: totalCount ?? notifications.length,
                    },
                    {
                        value: 'unread' as const,
                        label: t('Unread'),
                        count: unreadCount,
                    },
                ]}
            >
                <TabsContent value={tab} className="mt-2 min-w-0">
                    {loading ? (
                        <ItemsSkeleton />
                    ) : failed ? (
                        <div
                            role="alert"
                            data-slot="notifications-failed"
                            className="flex flex-col items-center gap-3 border-t px-6 py-8 text-center"
                        >
                            <p className="text-body-sm text-muted-foreground">
                                {t('Could not load the notifications.')}
                            </p>
                            {onRetry ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="max-w-full"
                                    onClick={onRetry}
                                >
                                    <RefreshCw aria-hidden="true" />
                                    <span className="truncate">
                                        {t('Retry')}
                                    </span>
                                </Button>
                            ) : null}
                        </div>
                    ) : visible.length === 0 ? (
                        <div
                            data-slot="notifications-empty"
                            className="flex flex-col items-center gap-2 border-t px-6 py-8 text-center"
                        >
                            <span
                                aria-hidden="true"
                                className="mb-1 grid size-12 place-items-center rounded-full bg-skrum-success-soft text-skrum-success-text"
                            >
                                <CheckCheck className="size-5" />
                            </span>
                            <p className="text-ui-lg font-semibold">
                                {emptyTitle}
                            </p>
                            <p className="max-w-70 text-body-sm text-muted-foreground">
                                {emptyDescription}
                            </p>
                        </div>
                    ) : (
                        <div className="max-h-105 overflow-y-auto">
                            <ul role="list" onKeyDown={moveFocus}>
                                {visible.map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        now={reference}
                                        locale={resolvedLocale}
                                        onOpen={onOpen}
                                        onInvite={onInvite}
                                        onJoin={onJoin}
                                    />
                                ))}
                            </ul>
                            {hasMore && onLoadMore ? (
                                <div className="border-t p-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full"
                                        onClick={onLoadMore}
                                    >
                                        <span className="truncate">
                                            {t('Load more')}
                                        </span>
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
            <div className="border-t p-1">
                <Link
                    href={settingsHref}
                    className="flex h-9 items-center gap-2 rounded-sm px-3 text-body-sm font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                    <Settings
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate">
                        {t('Notification settings')}
                    </span>
                    <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                    />
                </Link>
            </div>
        </div>
    );
}

export type NotificationsBellProps = Omit<
    ComponentProps<typeof Button>,
    'children' | 'variant' | 'size'
> & {
    unreadCount: number;
    open?: boolean;
    arriving?: boolean;
    announcement?: string;
};

export function NotificationsBell({
    unreadCount,
    open = false,
    arriving = false,
    announcement,
    className,
    ...props
}: NotificationsBellProps) {
    const { t } = useTrans();
    const Icon = arriving ? BellRing : Bell;
    const label =
        unreadCount > 0
            ? t('Notifications, :count unread', { count: unreadCount })
            : t('Notifications');

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                aria-label={label}
                aria-haspopup="dialog"
                aria-expanded={open}
                data-state={open ? 'open' : 'closed'}
                data-arriving={arriving ? 'true' : undefined}
                className={cn(
                    'relative data-[state=open]:bg-accent data-[state=open]:ring-2 data-[state=open]:ring-ring',
                    arriving &&
                        'text-skrum-primary-text shadow-[0_0_0_0.25rem_color-mix(in_oklch,var(--primary)_22%,transparent)]',
                    className,
                )}
                {...props}
            >
                <Icon aria-hidden="true" className="size-5" />
                {unreadCount > 0 ? (
                    <span
                        aria-hidden="true"
                        data-slot="notifications-badge"
                        className="absolute top-0.5 right-0.5 h-4.5 min-w-4.5 rounded-full bg-destructive px-1 text-center text-overline leading-4.5 text-destructive-foreground tabular-nums ring-2 ring-background"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                ) : null}
            </Button>
            <span
                role="status"
                aria-live="polite"
                data-slot="notifications-live"
                className="sr-only"
            >
                {announcement}
            </span>
        </>
    );
}
