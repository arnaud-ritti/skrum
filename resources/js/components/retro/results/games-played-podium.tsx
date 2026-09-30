import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GamesPlayedLeaderRow } from '@/lib/retro/types';

const PodiumSize = 3;

export function GamesPlayedPodium({
    leaderboard,
}: {
    leaderboard: GamesPlayedLeaderRow[];
}) {
    const { t } = useTrans();
    const [showAll, setShowAll] = useState(false);
    const shown = showAll ? leaderboard : leaderboard.slice(0, PodiumSize);

    if (leaderboard.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            <ol className="grid gap-2 sm:grid-cols-3">
                {shown.map((row, index) => (
                    <li
                        key={row.playerId}
                        className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                    >
                        <span className="w-5 text-right font-semibold text-muted-foreground tabular-nums">
                            {index + 1}
                        </span>
                        <img
                            src={row.avatarUrl}
                            alt=""
                            className="size-7 rounded-full bg-muted"
                        />
                        <span className="min-w-0 flex-1 truncate">
                            {row.name}
                            {row.isGuest && (
                                <span className="text-muted-foreground">
                                    {' '}
                                    {t('(guest)')}
                                </span>
                            )}
                        </span>
                        <span className="font-semibold tabular-nums">
                            {t(':count points', { count: row.points })}
                        </span>
                    </li>
                ))}
            </ol>
            {leaderboard.length > PodiumSize && (
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAll((current) => !current)}
                >
                    {showAll ? t('Show less') : t('Show all')}
                </Button>
            )}
        </div>
    );
}
