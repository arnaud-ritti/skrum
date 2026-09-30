import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { ResetScoresDialog } from './reset-scores-dialog';
import { useRoom } from './room-context';

export function RoomScores() {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const [confirming, setConfirming] = useState(false);
    const players = new Map(
        snapshot.players.map((player) => [player.id, player]),
    );
    const canReset = snapshot.room.canManage && !snapshot.room.isIcebreaker;

    return (
        <div className="space-y-3">
            {snapshot.leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No points yet.')}
                </p>
            ) : (
                <ol className="space-y-1">
                    {snapshot.leaderboard.map((row, index) => {
                        const player = players.get(row.playerId);

                        return (
                            <li
                                key={row.playerId}
                                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"
                            >
                                <span className="w-5 text-right text-muted-foreground tabular-nums">
                                    {index + 1}
                                </span>
                                {player && (
                                    <img
                                        src={player.avatarUrl}
                                        alt=""
                                        className="size-6 rounded-full bg-muted"
                                    />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    {player?.name ?? t('Former member')}
                                    {player?.isGuest && (
                                        <span className="text-muted-foreground">
                                            {' '}
                                            {t('(guest)')}
                                        </span>
                                    )}
                                </span>
                                <span
                                    className="font-semibold tabular-nums"
                                    aria-label={t(':count points', {
                                        count: row.points,
                                    })}
                                >
                                    {row.points}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
            {canReset && (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirming(true)}
                    >
                        {t('Reset scores')}
                    </Button>
                    <ResetScoresDialog
                        open={confirming}
                        onOpenChange={setConfirming}
                    />
                </>
            )}
        </div>
    );
}
