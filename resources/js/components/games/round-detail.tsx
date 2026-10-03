import { CircleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { ClueRow } from './clue-row';
import { DrawingCanvas } from './drawing-canvas';
import { MoodWeatherResult } from './mood-weather-board';
import { GifRoundResults } from './gif-round-results';
import { useRoom } from './room-context';
import { TwoTruthsResult } from './two-truths-board';
import { WordMask } from './word-mask';

export function RoundDetail({ roundId }: { roundId: string }) {
    const { snapshot, handleError } = useRoom();
    const { t } = useTrans();
    const [detail, setDetail] = useState<GameRoundDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const roomId = snapshot.room.id;

    useEffect(() => {
        let isCurrent = true;

        retroRequest<GameRoundDetail>(
            GameRoundsController.show({ room: roomId, round: roundId }),
        )
            .then((fresh) => {
                if (isCurrent) {
                    setDetail(fresh);
                }
            })
            .catch((failure: unknown) => {
                if (isCurrent) {
                    setError(
                        handleError(failure) ??
                            t('Something went wrong. Please try again.'),
                    );
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [roomId, roundId, handleError, t]);

    if (error !== null) {
        return (
            <p
                role="alert"
                className="flex items-start gap-1.5 text-sm text-skrum-destructive-text"
            >
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">{error}</span>
            </p>
        );
    }

    if (detail === null) {
        return <Spinner />;
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" shape="pill">
                    {outcomeLabel(detail.outcome, t)}
                </Badge>
                {detail.winnerName && (
                    <span className="text-sm text-muted-foreground">
                        {t(':name found it!', { name: detail.winnerName })}
                    </span>
                )}
            </div>
            {detail.leaderName && (
                <p className="text-sm text-muted-foreground">
                    {t('Led by :name', { name: detail.leaderName })}
                </p>
            )}
            <GameDetail detail={detail} />
        </div>
    );
}

function GameDetail({ detail }: { detail: GameRoundDetail }) {
    const { t } = useTrans();

    switch (detail.game) {
        case 'hangman':
            return (
                <div className="space-y-2">
                    <WordMask mask={detail.mask ?? []} />
                    <p className="text-center text-sm break-words text-muted-foreground">
                        {t('Letters tried: :letters', {
                            letters: (detail.pickedLetters ?? [])
                                .join(' ')
                                .toUpperCase(),
                        })}
                    </p>
                </div>
            );
        case 'draw':
            return (
                <div className="space-y-2">
                    <DrawingCanvas
                        ops={detail.drawing ?? []}
                        label={t('Drawing of :word', {
                            word: detail.word ?? '',
                        })}
                    />
                    {detail.word && (
                        <p className="text-center font-display text-xl font-bold break-words">
                            {detail.word}
                        </p>
                    )}
                </div>
            );
        case 'decoded':
            return (
                <div className="space-y-2">
                    <ClueRow clue={detail.clue ?? []} />
                    {detail.word && (
                        <p className="text-center font-display text-xl font-bold break-words">
                            {detail.word}
                        </p>
                    )}
                </div>
            );
        case 'gif':
            return (
                <div className="space-y-3">
                    <p className="font-medium">{detail.question}</p>
                    <GifRoundResults answers={detail.answers ?? []} />
                </div>
            );
        case 'two_truths':
            return (
                <TwoTruthsResult
                    statements={detail.statements ?? []}
                    lieIndex={detail.lieIndex ?? null}
                    votes={detail.votes ?? []}
                />
            );
        case 'mood':
            return (
                <MoodWeatherResult
                    answered={detail.answered ?? 0}
                    weather={detail.weather ?? null}
                />
            );
        case 'guess_who':
            return null;
        case 'quick_question':
            return null;
        default:
            return detail.word ? (
                <p className="font-display text-xl font-bold break-words">
                    {detail.word}
                </p>
            ) : null;
    }
}
