import { Crown, Flame, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type GameLeaderboardPeriod = '30d' | 'all';

const LeaderboardPeriods: GameLeaderboardPeriod[] = ['30d', 'all'];

export type GamesLeaderboardEntry = {
    userId: string;
    name: string;
    avatarUrl?: string | null;
    presence?: AvatarPresence;
    points: number;
    wins: number;
    gamesPlayed: number;
    streak?: number;
};

const StreakBadgeFrom = 2;

function useCounts() {
    const { t } = useTrans();

    return {
        players: (count: number) =>
            count === 1
                ? t(':count player', { count })
                : t(':count players', { count }),
        rounds: (count: number) =>
            count === 1
                ? t(':count round', { count })
                : t(':count rounds', { count }),
        games: (count: number) =>
            count === 1
                ? t(':count game', { count })
                : t(':count games', { count }),
        wins: (count: number) =>
            count === 1
                ? t(':count win', { count })
                : t(':count wins', { count }),
    };
}

function formatNumber(value: number): string {
    const locale =
        typeof document === 'undefined'
            ? undefined
            : document.documentElement.lang || undefined;

    return new Intl.NumberFormat(locale).format(value);
}

function EmptyBlock({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div
            data-slot="games-empty"
            className="flex flex-col items-center gap-3 px-4 py-8 text-center"
        >
            <span
                aria-hidden
                className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
                <Icon className="size-6" />
            </span>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description && (
                <p className="max-w-sm text-sm text-muted-foreground">
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}

export type LeaderboardProps = {
    period: GameLeaderboardPeriod;
    onPeriodChange: (period: GameLeaderboardPeriod) => void;
    entries?: GamesLeaderboardEntry[];
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    currentUserId?: string;
    className?: string;
};

const podiumSlots = [
    { place: 1, order: 'order-2', step: 'h-20' },
    { place: 2, order: 'order-1', step: 'h-14' },
    { place: 3, order: 'order-3', step: 'h-10' },
] as const;

function PodiumPlace({
    place,
    order,
    step,
    entry,
    isMe,
}: {
    place: number;
    order: string;
    step: string;
    entry?: GamesLeaderboardEntry;
    isMe: boolean;
}) {
    const { t } = useTrans();

    if (!entry) {
        return (
            <li
                aria-hidden
                data-slot="podium-empty"
                className={cn('flex flex-col justify-end', order)}
            >
                <div
                    className={cn(
                        'rounded-t-md border border-dashed border-input',
                        step,
                    )}
                />
            </li>
        );
    }

    return (
        <li
            data-slot="podium-place"
            data-place={place}
            data-me={isMe || undefined}
            className={cn('flex min-w-0 flex-col items-center gap-1', order)}
        >
            <div className="flex w-full min-w-0 flex-col items-center gap-1 px-1 text-center">
                {place === 1 && (
                    <Crown
                        aria-hidden
                        className="size-5 text-skrum-warning"
                        data-slot="podium-crown"
                    />
                )}
                <PersonAvatar
                    name={entry.name}
                    src={entry.avatarUrl}
                    presence={entry.presence}
                    size="lg"
                    decorative
                    className={cn(isMe && 'ring-2 ring-ring ring-offset-2')}
                />
                <span className="max-w-full truncate text-sm font-semibold">
                    {entry.name}
                    {isMe && <span className="sr-only"> ({t('you')})</span>}
                </span>
                <span
                    data-slot="podium-points"
                    className={cn(
                        'text-xs font-semibold whitespace-nowrap tabular-nums',
                        place === 1
                            ? 'text-skrum-primary-text'
                            : 'text-muted-foreground',
                    )}
                >
                    {formatNumber(entry.points)} {t('pts')}
                </span>
                {(entry.streak ?? 0) >= StreakBadgeFrom && (
                    <Badge
                        variant="outline"
                        icon={Flame}
                        className="max-w-full"
                    >
                        <span className="truncate">
                            {t(':count-week streak', {
                                count: entry.streak ?? 0,
                            })}
                        </span>
                    </Badge>
                )}
            </div>
            <div
                className={cn(
                    'flex w-full items-start justify-center rounded-t-md border border-b-0 pt-2 font-display text-xl font-bold',
                    step,
                    place === 1
                        ? 'border-primary/35 bg-skrum-primary-soft text-skrum-primary-text'
                        : 'bg-muted text-muted-foreground',
                )}
            >
                <span className="sr-only">{t('Place')} </span>
                {place}
            </div>
        </li>
    );
}

function LeaderboardBody({
    entries,
    currentUserId,
}: {
    entries: GamesLeaderboardEntry[];
    currentUserId?: string;
}) {
    const { t } = useTrans();
    const counts = useCounts();
    const isMe = (entry: GamesLeaderboardEntry): boolean =>
        currentUserId !== undefined && entry.userId === currentUserId;
    const rest = entries.slice(3);

    return (
        <div className="flex min-h-0 flex-col gap-4">
            <ol
                data-slot="podium"
                aria-label={t('Podium')}
                className="grid grid-cols-3 items-end gap-2"
            >
                {podiumSlots.map((slot) => (
                    <PodiumPlace
                        key={slot.place}
                        {...slot}
                        entry={entries[slot.place - 1]}
                        isMe={
                            entries[slot.place - 1] !== undefined &&
                            isMe(entries[slot.place - 1])
                        }
                    />
                ))}
            </ol>
            {rest.length > 0 && (
                <ol
                    start={4}
                    data-slot="leaderboard-list"
                    className="relative flex max-h-80 flex-col divide-y overflow-y-auto border-t"
                >
                    {rest.map((entry, index) => {
                        const me = isMe(entry);

                        return (
                            <li
                                key={entry.userId}
                                data-slot="leaderboard-row"
                                data-me={me || undefined}
                                className={cn(
                                    'flex items-center gap-3 p-2 text-sm',
                                    me && 'rounded-md bg-accent',
                                )}
                            >
                                <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">
                                    {index + 4}
                                </span>
                                <PersonAvatar
                                    name={entry.name}
                                    src={entry.avatarUrl}
                                    presence={entry.presence}
                                    size="sm"
                                    decorative
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-semibold">
                                        {entry.name}
                                        {me && (
                                            <span className="sr-only">
                                                {' '}
                                                ({t('you')})
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="truncate text-xs text-muted-foreground">
                                            {counts.games(entry.gamesPlayed)} ·{' '}
                                            {counts.wins(entry.wins)}
                                        </span>
                                        {(entry.streak ?? 0) >=
                                            StreakBadgeFrom && (
                                            <Badge
                                                variant="outline"
                                                icon={Flame}
                                                className="max-w-full"
                                            >
                                                <span className="truncate">
                                                    {t(':count-week streak', {
                                                        count:
                                                            entry.streak ?? 0,
                                                    })}
                                                </span>
                                            </Badge>
                                        )}
                                    </span>
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums">
                                    {formatNumber(entry.points)}{' '}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {t('pts')}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

export function Leaderboard({
    period,
    onPeriodChange,
    entries,
    loading = false,
    error = false,
    onRetry,
    currentUserId,
    className,
}: LeaderboardProps) {
    const { t } = useTrans();
    const isLoading = loading || (entries === undefined && !error);

    let body: ReactNode;

    if (error) {
        body = (
            <EmptyBlock
                icon={Trophy}
                title={t('Could not load the leaderboard.')}
                action={
                    onRetry && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onRetry}
                        >
                            <span className="truncate">{t('Try again')}</span>
                        </Button>
                    )
                }
            />
        );
    } else if (entries === undefined) {
        body = (
            <div
                data-slot="leaderboard-skeleton"
                className="flex flex-col gap-2"
            >
                {[0, 1, 2].map((index) => (
                    <Skeleton
                        key={index}
                        className="h-9 w-full animate-pulse motion-reduce:animate-none"
                    />
                ))}
            </div>
        );
    } else if (entries.length === 0) {
        body = (
            <EmptyBlock
                icon={Trophy}
                title={t('No games played yet.')}
                description={t(
                    'Scores show up here once the first game is finished.',
                )}
            />
        );
    } else {
        body = (
            <LeaderboardBody entries={entries} currentUserId={currentUserId} />
        );
    }

    return (
        <Tabs<GameLeaderboardPeriod>
            value={period}
            onValueChange={onPeriodChange}
            className="gap-0"
        >
            <Card data-slot="leaderboard" className={className}>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle>
                            <h2>{t('Leaderboard')}</h2>
                        </CardTitle>
                        <TabsList aria-label={t('Period')}>
                            <TabsTrigger value="30d">
                                {t('Last 30 days')}
                            </TabsTrigger>
                            <TabsTrigger value="all">
                                {t('All time')}
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 @max-card-narrow/card:px-4 @max-card-narrow/card:pb-4">
                    {LeaderboardPeriods.map((value) => (
                        <TabsContent
                            key={value}
                            value={value}
                            aria-busy={isLoading}
                            className={cn(
                                'rounded-md transition-opacity duration-140 ease-standard focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                                loading &&
                                    entries !== undefined &&
                                    'opacity-60',
                            )}
                        >
                            {value === period && body}
                        </TabsContent>
                    ))}
                </CardContent>
            </Card>
        </Tabs>
    );
}
