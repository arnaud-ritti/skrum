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
    stats?: { participants: number; cards?: number; actions?: number };
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

const statusTones: Record<SessionCardStatus, string> = {
    live: 'bg-skrum-success-soft text-skrum-success-text',
    scheduled: 'bg-skrum-info-soft text-skrum-info-text',
    ended: 'bg-muted text-muted-foreground',
};

const maxVisiblePeople = 3;

export function SessionCard({
    href,
    kind,
    title,
    team,
    when,
    status,
    stats,
    people = [],
    className,
}: SessionCardProps) {
    const { t } = useTrans();
    const getInitials = useInitials();
    const { icon: KindIcon, tone } = kinds[kind];
    const statusLabels: Record<SessionCardStatus, string> = {
        live: t('Live'),
        scheduled: t('Scheduled'),
        ended: t('Ended'),
    };
    const isLive = status === 'live';
    const showPresence = isLive && people.length > 0;
    const visiblePeople = people.slice(0, maxVisiblePeople);
    const hiddenPeople = people.length - visiblePeople.length;

    return (
        <Card asChild>
            <Link
                href={href}
                data-kind={kind}
                data-status={status}
                className={cn(
                    'block gap-3 p-4 transition-shadow duration-150 outline-none hover:border-primary/35 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring',
                    className,
                )}
            >
                <span className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 @max-card-compact/card:grid-cols-1 @card-wide/card:grid-cols-[auto_minmax(0,1fr)_auto] @card-wide/card:items-center">
                    <span
                        aria-hidden
                        className={cn(
                            'row-span-2 flex size-8 items-center justify-center rounded-md @max-card-compact/card:hidden @card-wide/card:row-span-1',
                            tone,
                        )}
                    >
                        <KindIcon className="size-4" />
                    </span>
                    <span className="block min-w-0">
                        <span className="line-clamp-2 block font-semibold">
                            {title}
                        </span>
                        <span className="block truncate text-xs font-medium text-muted-foreground">
                            {team} · {when}
                        </span>
                    </span>
                    <Badge
                        className={cn(
                            'col-start-2 justify-self-start rounded-full border-transparent @max-card-compact/card:col-start-1 @card-wide/card:col-start-3 @card-wide/card:row-start-1',
                            statusTones[status],
                        )}
                    >
                        {isLive && (
                            <span
                                aria-hidden
                                className="size-1.5 rounded-full bg-skrum-success"
                            />
                        )}
                        {statusLabels[status]}
                    </Badge>
                </span>
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
            </Link>
        </Card>
    );
}
