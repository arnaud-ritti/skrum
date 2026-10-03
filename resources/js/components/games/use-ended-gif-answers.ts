import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import type { GameGifRevealed, GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

/**
 * The end card and the podium both ask for the GIFs of the same round when the
 * page is opened between two rounds: one request serves both.
 */
const inFlight = new Map<string, Promise<GameRoundDetail>>();

function roundDetail(
    roomId: string,
    roundId: string,
): Promise<GameRoundDetail> {
    const key = `${roomId}:${roundId}`;
    const pending = inFlight.get(key);

    if (pending) {
        return pending;
    }

    const request = retroRequest<GameRoundDetail>(
        GameRoundsController.show({ room: roomId, round: roundId }),
    ).finally(() => inFlight.delete(key));

    inFlight.set(key, request);

    return request;
}

/**
 * The closed GIFs of the room's last round between two rounds: from the end of
 * the round when it was seen live, else from its detail.
 */
export function useEndedGifAnswers(): GameGifRevealed[] | null {
    const { snapshot, lastEnded } = useRoom();
    const roomId = snapshot.room.id;
    const lastRound =
        snapshot.history.find(
            (round) => round.id === snapshot.room.currentRoundId,
        ) ?? null;
    const gifRoundId =
        !snapshot.round && lastRound?.game === 'gif' && !lastEnded?.answers
            ? lastRound.id
            : null;
    const [fetched, setFetched] = useState<{
        roundId: string;
        answers: GameGifRevealed[];
    } | null>(null);

    useEffect(() => {
        if (gifRoundId === null) {
            return;
        }

        let isCurrent = true;

        roundDetail(roomId, gifRoundId)
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

    if (lastEnded?.answers) {
        return lastEnded.answers;
    }

    return fetched !== null && fetched.roundId === gifRoundId
        ? fetched.answers
        : null;
}
