import {
    Brush,
    Check,
    Crown,
    MessageCircle,
    RotateCcw,
    Smile,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useTrans } from '@/hooks/use-trans';
import { pendingAnswers } from '@/lib/games/gif';
import { findTime } from '@/lib/games/redo';
import type { GamePlayer, GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { PlayerPoints, PlayerRow } from './player-row';
import { ResetScoresDialog } from './reset-scores-dialog';
import { useRoom } from './room-context';

/** Who has done the step in play of a Sprint in one GIF round; null for another game. */
function gifDoneIds(
    round: GameRound | null,
    myPlayerId: string,
): Set<string> | null {
    if (round?.game !== 'gif') {
        return null;
    }

    if (round.revealedAt !== null) {
        return new Set(round.voters ?? []);
    }

    const answered = pendingAnswers(round).map((answer) => answer.playerId);

    return new Set(round.myAnswer ? [...answered, myPlayerId] : answered);
}

function GifPlayerStatus({ done, voting }: { done: boolean; voting: boolean }) {
    const { t } = useTrans();

    if (!done) {
        return voting ? t('voting…') : t('picking…');
    }

    return (
        <span className="inline-flex items-center gap-1 text-skrum-success-text">
            <Check aria-hidden className="size-3.5 shrink-0" />
            {voting ? t('voted') : t('GIF picked')}
        </span>
    );
}

/** What a player does in a round led by one of them: Draw & Guess, Decoded. */
export function LedPlayerStatus({
    isLeader,
    isDraw,
    foundAfter,
}: {
    isLeader: boolean;
    isDraw: boolean;
    /** Seconds from the start to the find of a Draw & Guess finder (spec §6.15). */
    foundAfter: number | null;
}) {
    const { t } = useTrans();

    if (foundAfter !== null) {
        return (
            <span className="inline-flex items-center gap-1 text-skrum-success-text">
                <Check aria-hidden className="size-3.5 shrink-0" />
                {t('found · :time', { time: findTime(foundAfter) })}
            </span>
        );
    }

    if (!isLeader) {
        return t('guessing…');
    }

    const Icon = isDraw ? Brush : Smile;

    return (
        <span className="inline-flex items-center gap-1 text-skrum-primary-text">
            <Icon aria-hidden className="size-3.5 shrink-0" />
            {isDraw ? t('drawing') : t('giving clues')}
        </span>
    );
}

/** Two truths: who tells the round in play, and who has statements ready (spec §9.7). */
function TruthPlayerStatus({
    isTeller,
    isReady,
}: {
    isTeller: boolean;
    isReady: boolean;
}) {
    const { t } = useTrans();

    if (isTeller) {
        return (
            <span className="inline-flex items-center gap-1 text-skrum-primary-text">
                <MessageCircle aria-hidden className="size-3.5 shrink-0" />
                {t('telling')}
            </span>
        );
    }

    if (!isReady) {
        return undefined;
    }

    return (
        <span className="inline-flex items-center gap-1 text-skrum-success-text">
            <Check aria-hidden className="size-3.5 shrink-0" />
            {t('Statements ready')}
        </span>
    );
}

type Row = {
    playerId: string;
    player: GamePlayer | null;
    points: number;
    /** null for who has no point yet; players tied on points share it. */
    position: number | null;
};

type RoomPlayersProps = {
    /** "Scores", "Players", "Participants": what the mockup of the game calls the list. */
    title: string;
    /** The players of a room are read under "game-players"; a second list takes another id. */
    headingId?: string;
    /** Rank and points of each player, and the reset of who manages the room. */
    points?: boolean;
    /** What each player does in the round in play. */
    status?: boolean;
    /** The winner of the round that just ended. */
    highlightPlayerId?: string | null;
    className?: string;
};

/**
 * Who plays in a room, in one list: ranked by points where the game shows
 * them, with what each one does in the round in play.
 */
export function RoomPlayers({
    title,
    headingId = 'game-players',
    points = true,
    status = true,
    highlightPlayerId = null,
    className,
}: RoomPlayersProps) {
    const { snapshot, online } = useRoom();
    const { t } = useTrans();
    const [confirming, setConfirming] = useState(false);
    const { round, room, leaderboard } = snapshot;
    const onlineIds = new Set(online.map((member) => member.id));
    const byId = new Map(snapshot.players.map((player) => [player.id, player]));
    const onlineFirst = [...snapshot.players].sort(
        (first, second) =>
            Number(onlineIds.has(second.presenceId)) -
            Number(onlineIds.has(first.presenceId)),
    );
    const rankedIds = new Set(leaderboard.map((row) => row.playerId));
    const rows: Row[] = points
        ? [
              ...leaderboard.map((row) => ({
                  playerId: row.playerId,
                  player: byId.get(row.playerId) ?? null,
                  points: row.points,
                  position:
                      leaderboard.filter((other) => other.points > row.points)
                          .length + 1,
              })),
              ...onlineFirst
                  .filter((player) => !rankedIds.has(player.id))
                  .map((player) => ({
                      playerId: player.id,
                      player,
                      points: 0,
                      position: null,
                  })),
          ]
        : onlineFirst.map((player) => ({
              playerId: player.id,
              player,
              points: 0,
              position: null,
          }));
    const gifDone = status ? gifDoneIds(round, snapshot.me.playerId) : null;
    const isPicking = gifDone !== null && round?.revealedAt === null;
    const onlinePlayers = snapshot.players.filter((player) =>
        onlineIds.has(player.presenceId),
    ).length;
    const expected = Math.max(onlinePlayers, gifDone?.size ?? 0);
    const readyLabel =
        gifDone !== null && isPicking
            ? t(':done / :total ready', {
                  done: gifDone.size,
                  total: expected,
              })
            : null;
    const ledRound =
        status && (round?.game === 'draw' || round?.game === 'decoded')
            ? round
            : null;
    const readyIds =
        status && room.game === 'two_truths' && snapshot.truthSets
            ? new Set(snapshot.truthSets.ready)
            : null;
    const tellerId = round?.game === 'two_truths' ? round.leaderPlayerId : null;
    const canReset = points && room.canManage && !room.isIcebreaker;

    const detailOf = (row: Row): ReactNode => {
        if (row.player === null) {
            return undefined;
        }

        if (readyIds !== null) {
            return (
                <TruthPlayerStatus
                    isTeller={row.playerId === tellerId}
                    isReady={readyIds.has(row.playerId)}
                />
            );
        }

        if (gifDone !== null) {
            return (
                <GifPlayerStatus
                    done={gifDone.has(row.playerId)}
                    voting={!isPicking}
                />
            );
        }

        if (ledRound !== null) {
            return (
                <LedPlayerStatus
                    isLeader={row.playerId === ledRound.leaderPlayerId}
                    isDraw={ledRound.game === 'draw'}
                    foundAfter={
                        ledRound.finders?.find(
                            (finder) => finder.playerId === row.playerId,
                        )?.seconds ?? null
                    }
                />
            );
        }

        return undefined;
    };

    const rankOf = (row: Row): ReactNode => {
        if (!points) {
            return undefined;
        }

        if (row.position === null) {
            return <span aria-hidden>–</span>;
        }

        if (row.position > 1) {
            return row.position;
        }

        return (
            <>
                <Crown
                    aria-hidden
                    className="size-3.5 text-skrum-warning-text"
                />
                <span className="sr-only">1</span>
            </>
        );
    };

    return (
        <section
            aria-labelledby={headingId}
            data-slot={points ? 'room-scores' : 'room-participants'}
            className={cn('flex min-w-0 flex-col gap-2', className)}
        >
            <div className="flex items-baseline justify-between gap-2">
                <h2
                    id={headingId}
                    className="min-w-0 truncate text-base font-title"
                >
                    {title}
                </h2>
                <span className="shrink-0 text-xs text-muted-foreground">
                    {readyLabel ??
                        (snapshot.players.length === 1
                            ? t(':count player', { count: 1 })
                            : t(':count players', {
                                  count: snapshot.players.length,
                              }))}
                </span>
            </div>
            {gifDone !== null && readyLabel !== null && (
                <Progress
                    data-slot="gif-ready"
                    value={gifDone.size}
                    max={Math.max(expected, 1)}
                    valueLabel=""
                    aria-label={readyLabel}
                    aria-valuetext={readyLabel}
                />
            )}
            <ol className="flex flex-col gap-0.5">
                {rows.map((row) => (
                    <PlayerRow
                        key={row.playerId}
                        name={row.player?.name ?? t('Former member')}
                        avatarUrl={row.player?.avatarUrl ?? null}
                        isGuest={row.player?.isGuest ?? false}
                        isMe={row.playerId === snapshot.me.playerId}
                        isHost={row.playerId === room.hostPlayerId}
                        isTurn={
                            row.playerId ===
                            (ledRound?.leaderPlayerId ?? tellerId)
                        }
                        offline={
                            row.player !== null &&
                            !onlineIds.has(row.player.presenceId)
                        }
                        rank={rankOf(row)}
                        detail={detailOf(row)}
                        trailing={
                            <>
                                {row.playerId === highlightPlayerId && (
                                    <Check
                                        className="size-4 shrink-0 text-skrum-success-text"
                                        aria-label={t('Winner')}
                                    />
                                )}
                                {points && <PlayerPoints points={row.points} />}
                            </>
                        }
                    />
                ))}
            </ol>
            {points && leaderboard.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('No points yet.')}
                </p>
            )}
            {canReset && (
                <>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1 max-w-full self-start"
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
        </section>
    );
}
