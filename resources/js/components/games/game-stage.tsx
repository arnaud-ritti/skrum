import { TimeUpBadge } from '@/components/session/session-timer';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { DecodedBoard } from './decoded-board';
import { DrawBoard } from './draw-board';
import { GifAnswerStage } from './gif-answer-stage';
import { GifStepLine, useGifStep } from './gif-steps';
import { GifVotingStage } from './gif-voting-stage';
import { GuessWhoBoard } from './guess-who-board';
import { HangmanBoard } from './hangman-board';
import { HistoryDrawer } from './history-drawer';
import { MoodWeatherBoard } from './mood-weather-board';
import { PassRoundButton } from './pass-round-button';
import { QuestionBanner } from './question-banner';
import { QuickQuestionBoard } from './quick-question-board';
import { useIsObservingRoom, useRoom } from './room-context';
import { RoundEndCard } from './round-end-card';
import { RoundInfo } from './round-info';
import { TurnTimer } from './turn-timer';
import { UndercoverBoard } from './undercover-board';
import { TwoTruthsBoard } from './two-truths-board';

/** A round of Sprint in one GIF: the question, then the picks or the gallery to vote on. */
function SprintGifBoard({ round }: { round: GameRound }) {
    const { t } = useTrans();
    const isPicking = round.revealedAt === null;

    return (
        <div
            data-slot="sprint-gif-board"
            className="flex w-full flex-col items-center gap-4"
        >
            <QuestionBanner
                round={round}
                hint={
                    isPicking
                        ? `${t('Pick a GIF that answers the question.')} ${t('GIFs stay hidden until the reveal.')}`
                        : t('Vote for your favourite GIF.')
                }
            />
            {isPicking ? (
                <GifAnswerStage round={round} />
            ) : (
                <GifVotingStage round={round} />
            )}
        </div>
    );
}

/** Keyed by round so live previews and tool state start clean each turn. */
function RoundBoard({ round }: { round: GameRound }) {
    const { t } = useTrans();

    switch (round.game) {
        case 'undercover':
            return <UndercoverBoard key={round.id} round={round} />;
        case 'hangman':
            return <HangmanBoard round={round} />;
        case 'draw':
            return <DrawBoard key={round.id} round={round} />;
        case 'decoded':
            return <DecodedBoard key={round.id} round={round} />;
        case 'gif':
            return <SprintGifBoard round={round} />;
        case 'two_truths':
            return <TwoTruthsBoard key={round.id} round={round} />;
        case 'mood':
            return <MoodWeatherBoard key={round.id} round={round} />;
        case 'guess_who':
            return <GuessWhoBoard key={round.id} round={round} />;
        case 'quick_question':
            return <QuickQuestionBoard key={round.id} round={round} />;
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

/** The centre of a room: the game's name, then the round in play or the end card. */
export function GameStage() {
    const { snapshot, lastEnded, serverOffset } = useRoom();
    const { t } = useTrans();
    const gifStep = useGifStep();
    const observing = useIsObservingRoom();
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
                    {round && <RoundInfo round={round} />}
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
                <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
                    {round && <TurnTimer round={round} />}
                    {round && !observing && <PassRoundButton round={round} />}
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
                <div
                    inert={observing}
                    data-slot="round-board"
                    className="contents"
                >
                    <RoundBoard round={round} />
                </div>
            ) : (
                <RoundEndCard />
            )}
        </section>
    );
}
