import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    ChartColumn,
    Layers,
    ListChecks,
    PenTool,
    Spade,
    Sparkles,
    StickyNote,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useInitials } from '@/hooks/use-initials';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type SessionCardKind =
    | 'retro'
    | 'poker'
    | 'whiteboard'
    | 'survey'
    | 'icebreaker';

export type SessionCardStatus = 'live' | 'scheduled' | 'ended';

export type SessionCardStatusTone = 'success' | 'info' | 'warning' | 'muted';

export type SessionCardPerson = {
    name: string;
    avatarUrl?: string | null;
};

export type SessionCardProps = {
    href: NonNullable<InertiaLinkProps['href']>;
    kind: SessionCardKind;
    title: string;
    team: string;
    when: string;
    status: SessionCardStatus;
    /** Replaces the default status word (the server's own phase name, for example). */
    statusLabel?: string;
    /** Colour of the status badge when the status alone does not say it (a phase, for example). */
    statusTone?: SessionCardStatusTone;
    /** The live dot of the badge; by default a live session has it. */
    statusDot?: boolean;
    /** Extra line inside the link: text and icons only, nothing interactive. */
    meta?: ReactNode;
    /** Rendered outside the link, so it may hold buttons or a menu. */
    action?: ReactNode;
    stats?: {
        participants: number;
        cards?: number;
        groups?: number;
        actions?: number;
    };
    people?: SessionCardPerson[];
    className?: string;
};

const kinds: Record<SessionCardKind, { icon: LucideIcon; tone: string }> = {
    retro: {
        icon: Layers,
        tone: 'bg-skrum-col-apricot text-skrum-col-apricot-text',
    },
    poker: {
        icon: Spade,
        tone: 'bg-skrum-col-iris text-skrum-col-iris-text',
    },
    whiteboard: {
        icon: PenTool,
        tone: 'bg-skrum-col-lagoon text-skrum-col-lagoon-text',
    },
    survey: {
        icon: ChartColumn,
        tone: 'bg-skrum-col-sky text-skrum-col-sky-text',
    },
    icebreaker: {
        icon: Sparkles,
        tone: 'bg-skrum-col-plum text-skrum-col-plum-text',
    },
};

const statusTones: Record<SessionCardStatus, SessionCardStatusTone> = {
    live: 'success',
    scheduled: 'info',
    ended: 'muted',
};

const tones: Record<SessionCardStatusTone, { badge: string; dot: string }> = {
    success: {
        badge: 'bg-skrum-success-soft text-skrum-success-text',
        dot: 'bg-skrum-success',
    },
    info: {
        badge: 'bg-skrum-info-soft text-skrum-info-text',
        dot: 'bg-skrum-info',
    },
    warning: {
        badge: 'bg-skrum-warning-soft text-skrum-warning-text',
        dot: 'bg-skrum-warning',
    },
    muted: {
        badge: 'bg-muted text-muted-foreground',
        dot: 'bg-muted-foreground',
    },
};

const maxVisiblePeople = 3;

export function SessionCard({
    href,
    kind,
    title,
    team,
    when,
    status,
    statusLabel,
    statusTone,
    statusDot,
    meta,
    action,
    stats,
    people = [],
    className,
}: SessionCardProps) {
    const { t } = useTrans();
    const getInitials = useInitials();
    const { icon: KindIcon, tone: kindTone } = kinds[kind];
    const statusLabels: Record<SessionCardStatus, string> = {
        live: t('Live'),
        scheduled: t('Scheduled'),
        ended: t('Ended'),
    };
    const isLive = status === 'live';
    const tone = tones[statusTone ?? statusTones[status]];
    const hasDot = statusDot ?? isLive;
    const showPresence = isLive && people.length > 0;
    const visiblePeople = people.slice(0, maxVisiblePeople);
    const hiddenPeople = people.length - visiblePeople.length;

    const hasAction = action !== undefined && action !== null;
    const content = (
        <>
            <span className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 @max-card-compact/card:grid-cols-1 @card-wide/card:grid-cols-[auto_minmax(0,1fr)_auto] @card-wide/card:items-center">
                <span
                    aria-hidden
                    className={cn(
                        'row-span-2 flex size-8 items-center justify-center rounded-md @max-card-compact/card:hidden @card-wide/card:row-span-1',
                        kindTone,
                    )}
                >
                    <KindIcon className="size-4" />
                </span>
                <span className="block min-w-0">
                    <span className="line-clamp-2 block font-semibold">
                        {title}
                    </span>
                    <span className="flex min-w-0 text-xs font-medium text-muted-foreground">
                        <span className="truncate">{team}</span>
                        <span
                            data-slot="session-card-when"
                            className="shrink-0 whitespace-pre"
                        >
                            {' · '}
                            {when}
                        </span>
                    </span>
                </span>
                <Badge
                    className={cn(
                        'col-start-2 max-w-full min-w-0 justify-self-start rounded-full border-transparent @max-card-compact/card:col-start-1 @card-wide/card:col-start-3 @card-wide/card:row-start-1',
                        tone.badge,
                    )}
                    data-slot="session-card-status"
                    data-tone={statusTone ?? statusTones[status]}
                >
                    {hasDot && (
                        <span
                            aria-hidden
                            data-slot="session-card-dot"
                            className={cn('size-1.5 rounded-full', tone.dot)}
                        />
                    )}
                    <span className="truncate">
                        {statusLabel ?? statusLabels[status]}
                    </span>
                </Badge>
            </span>
            {meta !== undefined && meta !== null && (
                <span
                    data-slot="session-card-meta"
                    className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground"
                >
                    {meta}
                </span>
            )}
            {showPresence && (
                <span className="flex items-center justify-between gap-2">
                    <span
                        data-slot="session-card-presence"
                        className="flex items-center -space-x-1.5"
                    >
                        {visiblePeople.map((person) => (
                            <Avatar
                                key={person.name}
                                className="size-6 ring-2 ring-card"
                                title={person.name}
                            >
                                {person.avatarUrl ? (
                                    <AvatarImage
                                        src={person.avatarUrl}
                                        alt=""
                                    />
                                ) : null}
                                <AvatarFallback className="text-overline tracking-normal">
                                    {getInitials(person.name)}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                        {hiddenPeople > 0 && (
                            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-overline font-semibold tracking-normal text-muted-foreground ring-2 ring-card">
                                +{hiddenPeople}
                            </span>
                        )}
                    </span>
                    <span className="text-xs font-semibold whitespace-nowrap text-skrum-primary-text">
                        {t('Join')} →
                    </span>
                </span>
            )}
            {!showPresence && stats && (
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground *:whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden />
                        {stats.participants}
                        <span className="sr-only">{t('participants')}</span>
                    </span>
                    {stats.cards !== undefined && (
                        <span className="inline-flex items-center gap-1">
                            <StickyNote className="size-3.5" aria-hidden />
                            {stats.cards}
                            <span className="@max-card-compact/card:sr-only">
                                {t('cards')}
                            </span>
                        </span>
                    )}
                    {stats.groups !== undefined && (
                        <span
                            data-slot="session-card-groups"
                            className="inline-flex items-center gap-1"
                        >
                            <Layers className="size-3.5" aria-hidden />
                            {stats.groups === 1
                                ? t('1 group')
                                : t(':count groups', { count: stats.groups })}
                        </span>
                    )}
                    {stats.actions !== undefined && (
                        <span className="inline-flex items-center gap-1">
                            <ListChecks className="size-3.5" aria-hidden />
                            {stats.actions}
                            <span className="@max-card-compact/card:sr-only">
                                {t('actions')}
                            </span>
                        </span>
                    )}
                </span>
            )}
        </>
    );

    if (hasAction) {
        return (
            <Card
                data-slot="session-card"
                className={cn(
                    'relative gap-3 p-4 transition-shadow duration-140 hover:border-primary/35 hover:shadow-raised has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring',
                    className,
                )}
            >
                <Link
                    href={href}
                    data-kind={kind}
                    data-status={status}
                    className="flex min-w-0 flex-col gap-3 outline-none after:absolute after:inset-0 after:rounded-xl"
                >
                    {content}
                </Link>
                <div
                    data-slot="session-card-action"
                    className="relative z-10 flex min-w-0 flex-wrap items-center justify-end gap-2"
                >
                    {action}
                </div>
            </Card>
        );
    }

    return (
        <Card
            asChild
            className={cn(
                'gap-3 p-4 transition-shadow duration-140 outline-none hover:border-primary/35 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring',
                className,
            )}
        >
            <Link href={href} data-kind={kind} data-status={status}>
                {content}
            </Link>
        </Card>
    );
}
