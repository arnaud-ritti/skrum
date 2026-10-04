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
    Users,
} from 'lucide-react';
import { Fragment, useId, useState } from 'react';
import type {
    ComponentProps,
    KeyboardEvent,
    MouseEvent,
    ReactNode,
} from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
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
export type BacklogNotificationKind = 'session_starting' | 'mention';

export type NotificationKind =
    | ActionItemNotificationKind
    | 'team_invite'
    | 'recap_ready'
    | 'access_request'
    | 'access_answered'
    | 'invitation_declined'
    | BacklogNotificationKind;

const KnownKinds: ReadonlySet<string> = new Set<NotificationKind>([
    'due_soon',
    'overdue',
    'team_invite',
    'recap_ready',
    'access_request',
    'access_answered',
    'invitation_declined',
    'session_starting',
    'mention',
]);

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
        /** Key of the linked ticket. */
        ticket?: string | null;
    };
};

export type NotificationActor = {
    name: string;
    presence: NotificationPresence;
    avatarUrl?: string;
    others?: number;
};

/**
 * An invitation to a workspace: `team` is the name of what is joined, and
 * `href` the invitation page, where the invitation is accepted.
 */
export type InvitationNotification = NotificationBase & {
    kind: 'team_invite';
    actor?: NotificationActor | null;
    team: string;
    answer?: 'accepted' | 'declined';
    href: string;
};

export type RecapNotification = NotificationBase & {
    kind: 'recap_ready';
    team?: string;
    session: { id: string; title: string };
    actionsCount?: number;
    /** null when too few people voted for an average to be shown. */
    roti?: number | null;
    href: string;
};

export type BacklogNotification = NotificationBase & {
    kind: BacklogNotificationKind;
    actor?: NotificationActor;
    session?: {
        id: string;
        title: string;
        startsAt: string;
        facilitator: string;
        ended?: boolean;
    };
    excerpt?: string;
    href: string;
};

export type AccessRequestStatus = 'pending' | 'approved' | 'declined';

export type AccessRequestDecision = 'approve' | 'decline';

/** A request to join a team, shown to the people who may add members to it. */
export type AccessRequestNotification = NotificationBase & {
    kind: 'access_request';
    actor: NotificationActor | null;
    team: string;
    excerpt: string | null;
    request: {
        id: string;
        status: AccessRequestStatus;
        /** Name of the person who answered, read live from the request. */
        decidedBy: string | null;
        /** The answer was just given from this bell. */
        decidedByYou?: boolean;
        updateUrl: string;
    };
    href: string;
};

/** The answer to a request, shown to the person who asked. */
export type AccessAnsweredNotification = NotificationBase & {
    kind: 'access_answered';
    team: string;
    outcome: Exclude<AccessRequestStatus, 'pending'>;
    href: string;
};

/**
 * An invitation the inviter sent was declined: `email` is the invited
 * address, `team` the team (or the workspace) it was for.
 */
export type InvitationDeclinedNotification = NotificationBase & {
    kind: 'invitation_declined';
    actor?: null;
    email: string;
    team: string;
    href: string;
};

export type AppNotification =
    | ActionItemNotification
    | InvitationNotification
    | RecapNotification
    | AccessRequestNotification
    | AccessAnsweredNotification
    | InvitationDeclinedNotification
    | BacklogNotification;

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
    /**
     * Accept / Decline are rendered only when given; without it an
     * invitation has one action, "View invitation", to its `href`.
     */
    onInvite?: (id: string, answer: 'accept' | 'decline') => void;
    /** Backlog: Join is rendered only when given. */
    onJoin?: (sessionId: string) => void;
    /** "Add to the team" and "Decline" are rendered only when given. */
    onAccessRequest?: (
        notification: AccessRequestNotification,
        decision: AccessRequestDecision,
    ) => void;
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

function oneDecimal(value: number, locale?: string): string {
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(value);
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
    onAccessRequest: NotificationsPanelProps['onAccessRequest'];
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
    onAccessRequest,
}: ItemProps) {
    const { t } = useTrans();
    const { kind } = notification;
    const actionNotification = isActionItemNotification(notification)
        ? notification
        : null;
    const actor =
        notification.kind === 'team_invite' ||
        notification.kind === 'mention' ||
        notification.kind === 'access_request'
            ? (notification.actor ?? undefined)
            : undefined;
    const href = isActionItemNotification(notification)
        ? notification.actionItem.url
        : notification.href;
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
    let linkIsButton = false;

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

    if (notification.kind === 'team_invite') {
        text = (
            <Rich
                template={t(':name invited you to join :workspace')}
                values={{ name: actorName, workspace: notification.team }}
            />
        );

        if (notification.answer === 'accepted') {
            meta = (
                <>
                    {t('Accepted · welcome to :team', {
                        team: notification.team,
                    })}
                </>
            );
        } else if (notification.answer === 'declined') {
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
        } else {
            linkLabel = t('View invitation');
            linkIsButton = true;
        }
    }

    if (notification.kind === 'session_starting' && notification.session) {
        const { session } = notification;
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
        const parts: { key: string; node: ReactNode }[] = [];

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

        parts.push({
            key: 'team',
            node: (
                <span className="min-w-0 break-words">
                    {actionItem.teamName}
                </span>
            ),
        });
        parts.push({ key: 'time', node: <span>{relative}</span> });

        leading = (
            <Tile tone={actionItem.isOverdue ? 'destructive' : 'primary'}>
                <CalendarClock />
            </Tile>
        );
        text =
            wording === 'overdue' ? (
                <Rich
                    template={t('Overdue action: :title')}
                    values={{ title: actionItem.content }}
                />
            ) : (
                <Rich
                    template={
                        wording === 'due_today'
                            ? t('Due today: :content')
                            : t('Due tomorrow: :content')
                    }
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

    if (notification.kind === 'mention') {
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

        if (notification.excerpt) {
            quote = (
                <blockquote className="my-1 rounded-sm border bg-background px-2 py-1.5 text-body-sm break-words text-foreground">
                    {notification.excerpt}
                </blockquote>
            );
        }

        if (notification.session) {
            meta = `${relative} · ${notification.session.title}`;
        }
    }

    if (notification.kind === 'access_request') {
        const { request } = notification;

        text = (
            <Rich
                template={t(':name asks to join :team')}
                values={{ name: actorName, team: notification.team }}
            />
        );

        if (notification.excerpt) {
            quote = (
                <p className="text-body-sm break-words text-muted-foreground">
                    {t('“:excerpt”', { excerpt: notification.excerpt })}
                </p>
            );
        }

        if (request.status === 'approved') {
            meta = `${relative} · ${
                request.decidedByYou
                    ? t('Added by you')
                    : t('Added by :name', {
                          name: request.decidedBy ?? t('Someone'),
                      })
            }`;
        }

        if (request.status === 'declined') {
            meta = `${relative} · ${
                request.decidedByYou
                    ? t('Declined by you')
                    : t('Declined by :name', {
                          name: request.decidedBy ?? t('Someone'),
                      })
            }`;
        }

        if (request.status === 'pending' && onAccessRequest) {
            actions = (
                <>
                    <Button
                        size="sm"
                        className="max-w-full"
                        onClick={() => onAccessRequest(notification, 'approve')}
                    >
                        <span className="truncate">{t('Add to the team')}</span>
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="max-w-full"
                        onClick={() => onAccessRequest(notification, 'decline')}
                    >
                        <span className="truncate">{t('Decline')}</span>
                    </Button>
                </>
            );
        }
    }

    if (notification.kind === 'access_answered') {
        leading = (
            <Tile tone="primary">
                <Users />
            </Tile>
        );
        text = (
            <Rich
                template={
                    notification.outcome === 'approved'
                        ? t('You were added to :team')
                        : t('Your request to join :team was declined')
                }
                values={{ team: notification.team }}
            />
        );
    }

    if (notification.kind === 'invitation_declined') {
        leading = <PersonAvatar decorative name={notification.email} />;
        text = (
            <Rich
                template={t(':email declined your invitation to join :team')}
                values={{ email: notification.email, team: notification.team }}
            />
        );
        linkLabel = t('View the team');
    }

    if (notification.kind === 'recap_ready') {
        const { actionsCount, roti } = notification;

        text = (
            <Rich
                template={t('The recap of :title is ready')}
                values={{ title: notification.session.title }}
            />
        );
        linkLabel = t('View recap');

        if (actionsCount !== undefined) {
            const values = {
                count: actionsCount,
                roti:
                    roti === null || roti === undefined
                        ? ''
                        : oneDecimal(roti, locale),
                when: relative,
            };
            const withRoti =
                actionsCount === 1
                    ? t(':count action item · ROTI :roti · :when', values)
                    : t(':count action items · ROTI :roti · :when', values);
            const withoutRoti =
                actionsCount === 1
                    ? t(':count action item · :when', values)
                    : t(':count action items · :when', values);

            meta = values.roti === '' ? withoutRoti : withRoti;
        }
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
                            linkIsButton
                                ? buttonVariants({
                                      size: 'sm',
                                      className: 'mt-2 max-w-full self-start',
                                  })
                                : 'mt-1 self-start text-body-sm font-semibold text-skrum-primary-text underline-offset-4 hover:underline',
                        )}
                    >
                        <span className="truncate">{linkLabel}</span>
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
    onAccessRequest,
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
    const known = notifications.filter((notification) =>
        KnownKinds.has(notification.kind),
    );
    const visible =
        tab === 'unread'
            ? known.filter((notification) => notification.readAt === null)
            : known;

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
                  'No unread notifications. Invitations, reminders and recaps will show up here.',
              )
            : t('Invitations, reminders and recaps will show up here.');

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
                                        onAccessRequest={onAccessRequest}
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
    /** A notification just arrived: ringing bell, halo, and a badge that pops unless motion is reduced. */
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
                        className={cn(
                            'absolute top-0.5 right-0.5 h-4.5 min-w-4.5 rounded-full bg-destructive px-1 text-center text-overline leading-4.5 text-destructive-foreground tabular-nums ring-2 ring-background',
                            arriving && 'motion-safe:animate-vote-pop',
                        )}
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
