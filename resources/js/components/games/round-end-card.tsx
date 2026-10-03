import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { withAwardedPoints } from '@/lib/games/leaderboard';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GamePointsAward } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { GifRoundResults } from './gif-round-results';
import { useRoom } from './room-context';
import { StartRoundControls } from './start-round-controls';
import { useEndedGifAnswers } from './use-ended-gif-answers';

function RoundPoints({ points }: { points: GamePointsAward[] }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );
    const scored = points.filter((award) => award.points > 0);

    if (scored.length === 0) {
        return null;
    }

    return (
        <ul
            className="flex flex-wrap justify-center gap-2"
            aria-label={t('Points of this round')}
        >
            {scored.map((award) => (
                <li key={award.playerId} className="max-w-full">
                    <Badge
                        variant={award.isWin ? 'success' : 'secondary'}
                        shape="pill"
                        className="max-w-full"
                    >
                        <span className="truncate">
                            {t('+:points :name', {
                                points: award.points,
                                name: names.get(award.playerId) ?? t('Someone'),
                            })}
                        </span>
                    </Badge>
                </li>
            ))}
        </ul>
    );
}

const PodiumSize = 3;

/** The room's best scores when a game of a set number of rounds is over (spec §6.4). */
function FinalScores() {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );
    const podium = withAwardedPoints(
        snapshot.leaderboard,
        [],
        snapshot.players,
    ).slice(0, PodiumSize);

    if (podium.length === 0) {
        return null;
    }

    return (
        <ol
            aria-label={t('Final scores')}
            data-slot="final-scores"
            className="flex w-full max-w-sm flex-col gap-1"
        >
            {podium.map((row, index) => (
                <li
                    key={row.playerId}
                    className="flex min-w-0 items-center gap-3 rounded-md bg-muted px-3 py-2 text-sm"
                >
                    <span className="w-4 shrink-0 font-semibold tabular-nums">
                        {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left">
                        {names.get(row.playerId) ?? t('Someone')}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                        {t(':count points', { count: row.points })}
                    </span>
                </li>
            ))}
        </ol>
    );
}

/** Between two rounds: what the last one gave, and the controls of the next. */
export function RoundEndCard() {
    const { snapshot, lastEnded } = useRoom();
    const { t } = useTrans();
    const lastRound =
        snapshot.history.find(
            (round) => round.id === snapshot.room.currentRoundId,
        ) ?? null;
    const outcome = lastEnded?.outcome ?? lastRound?.outcome ?? null;
    const word = lastEnded?.word ?? lastRound?.word ?? null;
    const winnerId =
        lastEnded?.winnerPlayerId ?? lastRound?.winnerPlayerId ?? null;
    const winner =
        snapshot.players.find((player) => player.id === winnerId) ?? null;
    const question = lastEnded?.question ?? lastRound?.question ?? null;
    const number = lastEnded?.number ?? lastRound?.number ?? null;
    const roundsTotal =
        lastEnded?.roundsTotal ?? lastRound?.roundsTotal ?? null;
    const isGameOver = number !== null && number === roundsTotal;
    const gifAnswers = useEndedGifAnswers();

    if (outcome === null) {
        return (
            <Card
                data-slot="round-start-card"
                className="w-full max-w-2xl items-center gap-4 px-6 py-10 text-center"
            >
                <h3 className="font-display text-xl font-title">
                    {t('Ready to play?')}
                </h3>
                <StartRoundControls label={t('Start')} />
            </Card>
        );
    }

    return (
        <Card
            data-slot="round-end-card"
            className={cn(
                'w-full max-w-2xl items-center gap-3 p-6 text-center',
                gifAnswers && 'max-w-4xl',
            )}
        >
            {isGameOver && (
                <h3 className="font-display text-2xl font-title">
                    {t('Game over')}
                </h3>
            )}
            <Badge variant="secondary" shape="pill">
                {outcomeLabel(outcome, t)}
            </Badge>
            {word && (
                <p className="max-w-full font-display text-3xl font-bold tracking-wide break-words">
                    {word}
                </p>
            )}
            {question && (
                <p className="max-w-full text-lg font-medium break-words">
                    {question}
                </p>
            )}
            {gifAnswers && (
                <GifRoundResults
                    answers={gifAnswers}
                    points={lastEnded?.answers ? lastEnded.points : []}
                />
            )}
            {winner && (
                <p className="text-muted-foreground">
                    {t(':name found it!', { name: winner.name })}
                </p>
            )}
            {lastEnded && !lastEnded.answers && (
                <RoundPoints points={lastEnded.points} />
            )}
            {isGameOver && <FinalScores />}
            <StartRoundControls label={t('Next round')} />
        </Card>
    );
}
