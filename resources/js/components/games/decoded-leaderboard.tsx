import { Check, Crown, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useTrans } from '@/hooks/use-trans';
import { decodedPuzzles } from '@/lib/games/decoded';
import { cn } from '@/lib/utils';
import { PlayerRow } from './player-row';
import { ResetScoresDialog } from './reset-scores-dialog';
import { useRoom } from './room-context';
import { LedPlayerStatus } from './room-players';

/**
 * Decoded's right column, as its mockup has it: the "Round leaderboard" of
 * the puzzle in play (or of the one that just ended) with what each player
 * earned in it, then the room's totals as bars. The first find ends a
 * Decoded round, so in play every player is still at zero.
 */
export function DecodedLeaderboard() {
    const { snapshot, lastEnded, online } = useRoom();
    const { t } = useTrans();
    const roundHeadingId = useId();
    const totalHeadingId = useId();
    const [confirming, setConfirming] = useState(false);
    const { room, round, leaderboard, players } = snapshot;
    const run = decodedPuzzles(snapshot.history, round, room);
    const live = round?.game === 'decoded' ? round : null;
    const ended = live === null ? lastEnded : null;
    const earned = new Map(
        (ended?.points ?? []).map((award) => [award.playerId, award.points]),
    );
    const leaderId = live?.leaderPlayerId ?? ended?.leaderPlayerId ?? null;
    const winnerId = ended?.winnerPlayerId ?? null;
    const onlineIds = new Set(online.map((member) => member.id));
    const rows = [...players].sort(
        (first, second) =>
            (earned.get(second.id) ?? 0) - (earned.get(first.id) ?? 0) ||
            Number(second.id === leaderId) - Number(first.id === leaderId) ||
            Number(onlineIds.has(second.presenceId)) -
                Number(onlineIds.has(first.presenceId)),
    );
    const names = new Map(players.map((player) => [player.id, player.name]));
    const topPoints = Math.max(1, ...leaderboard.map((row) => row.points));
    /** ponytail: the rounds of the most regular player stand for the room's, which no snapshot counts. */
    const roundsCounted = Math.max(
        0,
        ...leaderboard.map((row) => row.roundsPlayed),
    );
    const canReset = room.canManage && !room.isIcebreaker;

    return (
        <div
            data-slot="decoded-leaderboard"
            className="flex min-w-0 flex-col gap-4"
        >
            <section
                aria-labelledby={roundHeadingId}
                className="flex min-w-0 flex-col gap-2"
            >
                <div className="flex items-baseline justify-between gap-2">
                    <h2
                        id={roundHeadingId}
                        className="min-w-0 truncate text-base font-title"
                    >
                        {t('Round leaderboard')}
                    </h2>
                    {run !== null && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                            {t('Puzzle :number', { number: run.played })}
                        </span>
                    )}
                </div>
                <ol className="flex flex-col gap-0.5">
                    {rows.map((player) => {
                        const points = earned.get(player.id) ?? 0;
                        const isWinner = player.id === winnerId;

                        return (
                            <PlayerRow
                                key={player.id}
                                name={player.name}
                                avatarUrl={player.avatarUrl}
                                isGuest={player.isGuest}
                                isMe={player.id === snapshot.me.playerId}
                                isTurn={live !== null && player.id === leaderId}
                                offline={!onlineIds.has(player.presenceId)}
                                rank={
                                    isWinner ? (
                                        <>
                                            <Crown
                                                aria-hidden
                                                className="size-3.5 text-skrum-warning-text"
                                            />
                                            <span className="sr-only">1</span>
                                        </>
                                    ) : (
                                        <span aria-hidden>–</span>
                                    )
                                }
                                detail={
                                    isWinner ? (
                                        <span className="inline-flex items-center gap-1 text-skrum-success-text">
                                            <Check
                                                aria-hidden
                                                className="size-3.5 shrink-0"
                                            />
                                            {t('Winner')}
                                        </span>
                                    ) : live !== null ? (
                                        <LedPlayerStatus
                                            isLeader={player.id === leaderId}
                                            isDraw={false}
                                            foundAfter={null}
                                        />
                                    ) : undefined
                                }
                                trailing={
                                    <span
                                        data-slot="round-delta"
                                        className={cn(
                                            'shrink-0 text-xs font-bold whitespace-nowrap tabular-nums',
                                            points > 0
                                                ? 'text-skrum-success-text'
                                                : 'font-medium text-muted-foreground',
                                        )}
                                    >
                                        {points > 0 ? `+${points}` : 0}
                                    </span>
                                }
                            />
                        );
                    })}
                </ol>
            </section>
            <section
                aria-labelledby={totalHeadingId}
                className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-4 py-3 shadow-card"
            >
                <h3 id={totalHeadingId} className="text-sm font-semibold">
                    {roundsCounted === 1
                        ? t('Total after 1 round')
                        : t('Total after :count rounds', {
                              count: roundsCounted,
                          })}
                </h3>
                {leaderboard.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No points yet.')}
                    </p>
                ) : (
                    leaderboard.map((row) => {
                        const name =
                            names.get(row.playerId) ?? t('Former member');

                        return (
                            <div
                                key={row.playerId}
                                className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs"
                            >
                                <span className="truncate">{name}</span>
                                <Progress
                                    value={row.points}
                                    max={topPoints}
                                    valueLabel=""
                                    tone="primary"
                                    aria-label={name}
                                    aria-valuetext={t(':count points', {
                                        count: row.points,
                                    })}
                                    className="h-1.5"
                                />
                                <b className="text-right font-mono font-semibold tabular-nums">
                                    {row.points}
                                </b>
                            </div>
                        );
                    })
                )}
            </section>
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
