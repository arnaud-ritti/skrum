import { useCallback, useEffect, useRef } from 'react';
import PokerAutoRevealsController from '@/actions/App/Http/Controllers/Poker/PokerAutoRevealsController';
import { useCountdown } from '@/hooks/use-countdown';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

const DebounceMs = 2_000;

/**
 * The server decides; the facilitator's client only nudges it when someone
 * leaves (the everyone-voted set may now be complete) and when the countdown
 * ends (fallback for a delayed queue).
 */
export function AutoRevealTriggers({ departures }: { departures: number }) {
    const { snapshot, serverOffset, refetch } = useGame();
    const round = snapshot.current?.round ?? null;
    const isActive =
        snapshot.me.isFacilitator &&
        snapshot.game.autoReveal &&
        snapshot.game.endedAt === null &&
        round !== null &&
        round.revealedAt === null;
    const roundId = isActive && round !== null ? round.id : null;
    const remaining = useCountdown(
        isActive && round !== null ? round.timerEndsAt : null,
        serverOffset,
    );
    const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handledDepartures = useRef(departures);
    const gameId = snapshot.game.id;

    const request = useCallback(
        (targetRoundId: string) => {
            if (pending.current !== null) {
                clearTimeout(pending.current);
            }

            pending.current = setTimeout(() => {
                pending.current = null;

                retroRequest<{ revealed: boolean }>(
                    PokerAutoRevealsController.store({
                        game: gameId,
                        round: targetRoundId,
                    }),
                )
                    .then((response) => {
                        if (response?.revealed) {
                            void refetch();
                        }
                    })
                    .catch(() => {
                        // The next vote, departure or the timer job checks again.
                    });
            }, DebounceMs);
        },
        [gameId, refetch],
    );

    useEffect(() => {
        if (departures === handledDepartures.current) {
            return;
        }

        handledDepartures.current = departures;

        if (roundId !== null) {
            request(roundId);
        }
    }, [departures, roundId, request]);

    useEffect(() => {
        if (roundId !== null && remaining === 0) {
            request(roundId);
        }
    }, [remaining, roundId, request]);

    useEffect(
        () => () => {
            if (pending.current !== null) {
                clearTimeout(pending.current);
            }
        },
        [],
    );

    return null;
}
