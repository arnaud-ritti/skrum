import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import { DrawingCanvas } from '@/components/games/drawing-canvas';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import type { GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useBoard } from '../board-context';

type Props = {
    roomId: string;
    roundId: string | null;
    onClose: () => void;
};

/**
 * Drawings are not part of the results payload: the round detail endpoint
 * resolves the viewer as a player of the icebreaker room (spec §6.1).
 */
export function RoundReplayDialog({ roomId, roundId, onClose }: Props) {
    const { handleError } = useBoard();
    const { t } = useTrans();
    const [detail, setDetail] = useState<GameRoundDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (roundId === null) {
            return;
        }

        let isCurrent = true;

        setDetail(null);
        setError(null);

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

    return (
        <Dialog
            open={roundId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-2xl"
            >
                <DialogTitle>{t('Replay')}</DialogTitle>
                {error !== null ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : detail === null ? (
                    <Spinner />
                ) : (
                    <div className="space-y-2">
                        <DrawingCanvas
                            ops={detail.drawing ?? []}
                            label={t('Drawing of :word', {
                                word: detail.word ?? '',
                            })}
                        />
                        {detail.word && (
                            <p className="text-center text-xl font-semibold">
                                {detail.word}
                            </p>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
