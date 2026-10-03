import { useEffect, useState } from 'react';
import GameRoundsController from '@/actions/App/Http/Controllers/Games/GameRoundsController';
import type { GameKind, GameRoundDetail } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

/**
 * Several parts of the stage ask for the detail of the same round when the
 * page is opened between two rounds: one request serves them all.
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
 * The detail of the room's last round of `game` between two rounds, fetched
 * when the end of that round was not seen live (`seenLive` false): after a
 * reload, or when the page's own snapshot closed an expired round.
 */
export function useEndedRoundDetail(
    game: GameKind,
    seenLive: boolean,
): GameRoundDetail | null {
    const { snapshot } = useRoom();
    const roomId = snapshot.room.id;
    const lastRound =
        snapshot.history.find(
            (round) => round.id === snapshot.room.currentRoundId,
        ) ?? null;
    const roundId =
        !snapshot.round && lastRound?.game === game && !seenLive
            ? lastRound.id
            : null;
    const [fetched, setFetched] = useState<{
        roundId: string;
        detail: GameRoundDetail;
    } | null>(null);

    useEffect(() => {
        if (roundId === null) {
            return;
        }

        let isCurrent = true;

        roundDetail(roomId, roundId)
            .then((detail) => {
                if (isCurrent && detail) {
                    setFetched({ roundId, detail });
                }
            })
            .catch(() => undefined);

        return () => {
            isCurrent = false;
        };
    }, [roomId, roundId]);

    return fetched !== null && fetched.roundId === roundId
        ? fetched.detail
        : null;
}
