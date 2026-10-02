import { Crown, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { PlayerPoints, PlayerRow } from './player-row';
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
        <div className="flex min-w-0 flex-col gap-3">
            {snapshot.leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No points yet.')}
                </p>
            ) : (
                <ol className="flex flex-col gap-0.5">
                    {snapshot.leaderboard.map((row, index) => {
                        const player = players.get(row.playerId);

                        return (
                            <PlayerRow
                                key={row.playerId}
                                name={player?.name ?? t('Former member')}
                                avatarUrl={player?.avatarUrl ?? null}
                                isGuest={player?.isGuest ?? false}
                                isMe={row.playerId === snapshot.me.playerId}
                                rank={
                                    index === 0 ? (
                                        <>
                                            <Crown
                                                aria-hidden
                                                className="size-3.5 text-skrum-warning-text"
                                            />
                                            <span className="sr-only">1</span>
                                        </>
                                    ) : (
                                        index + 1
                                    )
                                }
                                trailing={<PlayerPoints points={row.points} />}
                            />
                        );
                    })}
                </ol>
            )}
            {canReset && (
                <>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="max-w-full self-start"
                        onClick={() => setConfirming(true)}
                    >
                        <RotateCcw aria-hidden />
                        <span className="truncate">{t('Reset scores')}</span>
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
