import type { ReactNode } from 'react';
import { TimeUpBadge } from '@/components/session/session-timer';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { DecodedBoard } from './decoded-board';
import { DrawBoard } from './draw-board';
import { GifStepLine, useGifStep } from './gif-steps';
import { HangmanBoard } from './hangman-board';
import { HistoryDrawer } from './history-drawer';
import { PassRoundButton } from './pass-round-button';
import { useRoom } from './room-context';
import { RoundEndCard } from './round-end-card';
import { SprintGifBoard } from './sprint-gif-board';

/** Keyed by round so live previews and tool state start clean each turn. */
function RoundBoard({
    round,
    gifCaption,
}: {
    round: GameRound;
    /** Place left under the chosen GIF of Sprint in one GIF (GM-3). */
    gifCaption?: ReactNode;
}) {
    const { t } = useTrans();

    switch (round.game) {
        case 'hangman':
            return <HangmanBoard round={round} />;
        case 'draw':
            return <DrawBoard key={round.id} round={round} />;
        case 'decoded':
            return <DecodedBoard key={round.id} round={round} />;
        case 'gif':
            return <SprintGifBoard round={round} caption={gifCaption} />;
        default:
            return (
                <p className="text-muted-foreground">
                    {t('This game is not available.')}
                </p>
            );
    }
}

/** Who leads the round in play: the line above the name of the game. */
function RoundStatus({ round }: { round: GameRound }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();

    if (round.game === 'gif') {
        return <GifStepLine step={round.revealedAt === null ? 1 : 2} />;
    }

    if (round.game !== 'draw' && round.game !== 'decoded') {
        return null;
    }

    const isDraw = round.game === 'draw';
    const leader = snapshot.players.find(
        (player) => player.id === round.leaderPlayerId,
    );
    let status: string | null = null;

    if (round.leaderPlayerId === snapshot.me.playerId) {
        status = isDraw ? t('You are drawing') : t('You are giving clues');
    } else if (leader) {
        status = isDraw
            ? t(':name is drawing', { name: leader.name })
            : t(':name is giving clues', { name: leader.name });
    }

    if (status === null) {
        return null;
    }

    return (
        <p
            data-slot="round-status"
            className="min-w-0 truncate text-overline text-muted-foreground uppercase"
        >
            {status}
        </p>
    );
}

export type GameStageProps = {
    /** Place left above the title for "Round n of m" (GM-2). */
    roundInfo?: ReactNode;
    /** Place left under the chosen GIF for its caption (GM-3). */
    gifCaption?: ReactNode;
};

/** The centre of a room: the game's name, then the round in play or the end card. */
export function GameStage({ roundInfo, gifCaption }: GameStageProps) {
    const { snapshot, lastEnded, serverOffset } = useRoom();
    const { t } = useTrans();
    const gifStep = useGifStep();
    const { room, round, games, history } = snapshot;
    const gameLabel =
        games.find((option) => option.value === room.game)?.label ?? room.game;
    const lastOutcome =
        lastEnded?.outcome ??
        history.find((played) => played.id === room.currentRoundId)?.outcome ??
        null;
    /** The end card of a round the timer ended already says "Time's up". */
    const endCardSaysTimeUp = round === null && lastOutcome === 'timed_out';
    const endedWord = lastEnded?.word ?? null;
    const announcedOutcome =
        round === null && lastOutcome !== null
            ? [outcomeLabel(lastOutcome, t), endedWord]
                  .filter((part) => part !== null)
                  .join(': ')
            : '';

    return (
        <section
            aria-labelledby="game-stage-title"
            data-slot="game-stage-content"
            className={cn(
                'flex w-full max-w-5xl flex-col items-center gap-5',
                /** A drawing takes the height the stage has left. */
                round?.game === 'draw' && 'min-h-0 flex-1',
            )}
        >
            <div className="flex w-full shrink-0 flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    {roundInfo}
                    {round && <RoundStatus round={round} />}
                    {gifStep === 3 && <GifStepLine step={3} />}
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2
                            id="game-stage-title"
                            tabIndex={-1}
                            className="min-w-0 truncate font-display text-2xl font-title"
                        >
                            {gameLabel}
                        </h2>
                        {!endCardSaysTimeUp && (
                            <TimeUpBadge
                                endsAt={room.timerEndsAt}
                                offset={serverOffset}
                            />
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {round && <PassRoundButton round={round} />}
                    <HistoryDrawer />
                </div>
            </div>
            <p
                role="status"
                data-slot="round-outcome-status"
                className="sr-only"
            >
                {announcedOutcome}
            </p>
            {round ? (
                <RoundBoard round={round} gifCaption={gifCaption} />
            ) : (
                <RoundEndCard />
            )}
        </section>
    );
}
