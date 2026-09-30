import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameGifRevealed, GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { GifRoundResults } from './gif-round-results';
import { useRoom } from './room-context';
import { RoundPoints } from './round-points';
import { StartRoundControls } from './start-round-controls';

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
            <div className="flex flex-col items-center gap-4 py-12 text-center">
                <h2 className="text-xl font-semibold">{t('Ready to play?')}</h2>
                <StartRoundControls label={t('Start')} />
            </div>
        );
    }

    return (
        <div className="flex w-full max-w-2xl flex-col items-center gap-3 rounded-lg border p-6 text-center">
            <Badge variant="secondary">{outcomeLabel(outcome, t)}</Badge>
            {word && (
                <p className="text-2xl font-semibold tracking-wide">{word}</p>
            )}
            {question && <p className="text-lg font-medium">{question}</p>}
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
        </div>
    );
}
