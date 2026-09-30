import { Deferred, router } from '@inertiajs/react';
import { Flame } from 'lucide-react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import type { GameLeaderboardPeriod, TeamGameLeaderboardRow } from '@/types';

type Props = {
    leaderboard?: TeamGameLeaderboardRow[];
    period: GameLeaderboardPeriod;
};

const StreakBadgeFrom = 2;

export function TeamLeaderboard({ leaderboard, period }: Props) {
    const { t } = useTrans();

    const choose = (next: string) => {
        if (next !== '30d' && next !== 'all') {
            return;
        }

        router.reload({
            data: { period: next },
            only: ['period', 'leaderboard'],
        });
    };

    return (
        <section className="space-y-3" aria-labelledby="team-leaderboard">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div id="team-leaderboard">
                    <Heading variant="small" title={t('Leaderboard')} />
                </div>
                <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={period}
                    onValueChange={choose}
                    aria-label={t('Period')}
                >
                    <ToggleGroupItem value="30d">
                        {t('Last 30 days')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="all">
                        {t('All time')}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
            <Deferred
                data="leaderboard"
                fallback={<LeaderboardSkeleton />}
                rescue={
                    <p className="text-sm text-muted-foreground">
                        {t('Could not load the leaderboard.')}{' '}
                        <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() =>
                                router.reload({ only: ['leaderboard'] })
                            }
                        >
                            {t('Try again')}
                        </Button>
                    </p>
                }
            >
                <LeaderboardRows rows={leaderboard ?? []} />
            </Deferred>
        </section>
    );
}

function LeaderboardSkeleton() {
    return (
        <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-9 w-full animate-pulse" />
            ))}
        </div>
    );
}

function LeaderboardRows({ rows }: { rows: TeamGameLeaderboardRow[] }) {
    const { t } = useTrans();

    if (rows.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                {t('No games played yet.')}
            </p>
        );
    }

    return (
        <ol className="divide-y rounded-md border">
            {rows.map((row, index) => (
                <li
                    key={row.userId}
                    className="flex items-center gap-3 p-2 text-sm"
                >
                    <span className="w-6 text-right text-muted-foreground tabular-nums">
                        {index + 1}
                    </span>
                    <img
                        src={row.avatarUrl}
                        alt=""
                        className="size-7 rounded-full bg-muted"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                        {row.name}
                    </span>
                    {row.streak >= StreakBadgeFrom && (
                        <Badge variant="outline" className="gap-1">
                            <Flame className="size-3.5 text-orange-500" />
                            {t(':count-week streak', { count: row.streak })}
                        </Badge>
                    )}
                    <span className="hidden text-muted-foreground sm:inline">
                        {t(':wins wins · :rounds rounds', {
                            wins: row.wins,
                            rounds: row.roundsPlayed,
                        })}
                    </span>
                    <span className="w-12 text-right font-semibold tabular-nums">
                        {row.points}
                    </span>
                </li>
            ))}
        </ol>
    );
}
