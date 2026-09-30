import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { outcomeLabel } from '@/lib/games/outcomes';
import type { GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';
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
                    setError(handleError(failure));
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [roomId, roundId, handleError]);

    if (error !== null) {
        return <p className="text-sm text-destructive">{error}</p>;
    }

    if (detail === null) {
        return <Spinner />;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Badge variant="secondary">
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
                    <p className="text-center text-sm text-muted-foreground">
                        {t('Letters tried: :letters', {
                            letters: (detail.pickedLetters ?? [])
                                .join(' ')
                                .toUpperCase(),
                        })}
                    </p>
                </div>
            );
        default:
            return detail.word ? (
                <p className="text-xl font-semibold">{detail.word}</p>
            ) : null;
    }
}
