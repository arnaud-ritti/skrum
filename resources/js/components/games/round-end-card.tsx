import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type {
    GameGifRevealed,
    GamePointsAward,
    GameRoundDetail,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { GifRoundResults } from './gif-round-results';
import { useRoom } from './room-context';
import { StartRoundControls } from './start-round-controls';

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
    const roomId = snapshot.room.id;
    const gifRoundId =
        lastRound?.game === 'gif' && !lastEnded?.answers ? lastRound.id : null;
    const [fetched, setFetched] = useState<{
        roundId: string;
        answers: GameGifRevealed[];
    } | null>(null);

    useEffect(() => {
        if (gifRoundId === null) {
            return;
        }

        let isCurrent = true;

        retroRequest<GameRoundDetail>(
            GameRoundsController.show({ room: roomId, round: gifRoundId }),
        )
            .then((detail) => {
                if (isCurrent && detail.answers) {
                    setFetched({
                        roundId: gifRoundId,
                        answers: detail.answers,
                    });
                }
            })
            .catch(() => undefined);

        return () => {
            isCurrent = false;
        };
    }, [roomId, gifRoundId]);

    const fetchedAnswers =
        fetched !== null && fetched.roundId === gifRoundId
            ? fetched.answers
            : null;

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
            className="w-full max-w-2xl items-center gap-3 p-6 text-center"
        >
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
            {lastEnded?.answers ? (
                <GifRoundResults
                    answers={lastEnded.answers}
                    points={lastEnded.points}
                />
            ) : (
                fetchedAnswers && <GifRoundResults answers={fetchedAnswers} />
            )}
            {winner && (
                <p className="text-muted-foreground">
                    {t(':name found it!', { name: winner.name })}
                </p>
            )}
            {lastEnded && !lastEnded.answers && (
                <RoundPoints points={lastEnded.points} />
            )}
            <StartRoundControls label={t('Next round')} />
        </Card>
    );
}
