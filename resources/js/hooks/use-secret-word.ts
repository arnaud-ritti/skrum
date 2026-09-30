import { useEffect } from 'react';
import { toast } from 'sonner';
import GameRoundSecretsController from '@/actions/App/Http/Controllers/Games/GameRoundSecretsController';
import { useRoom } from '@/components/games/room-context';
import type { GameRound, GameSecretResponse } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';

/**
 * The public `game.round.started` payload never carries the word, so the
 * leader asks for it; everyone else gets null.
 */
export function useSecretWord(round: GameRound): string | null {
    const { snapshot, dispatch, handleError } = useRoom();
    const isLeader = round.leaderPlayerId === snapshot.me.playerId;
    const needsWord = isLeader && round.word === undefined;
    const roomId = snapshot.room.id;
    const roundId = round.id;

    useEffect(() => {
        if (!needsWord) {
            return;
        }

        let isCurrent = true;

        retroRequest<GameSecretResponse>(
            GameRoundSecretsController.show({ room: roomId, round: roundId }),
        )
            .then((secret) => {
                if (isCurrent) {
                    dispatch({
                        type: 'round.patched',
                        roundId,
                        patch: { word: secret.word },
                    });
                }
            })
            .catch((error: unknown) => {
                const message = isCurrent ? handleError(error) : null;

                if (message !== null) {
                    toast.error(message);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [needsWord, roomId, roundId, dispatch, handleError]);

    return isLeader ? (round.word ?? null) : null;
}
