import { formatSeconds, useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { hintsUsed, nextAutoHintAt } from '@/lib/games/hints';
import type { GameRound } from '@/lib/games/types';
import { useRoom } from './room-context';

/**
 * When the server reveals its next letter on its own (spec §6.5). At zero it
 * says "now" until `game.hint.revealed` brings the letter and the next time;
 * after "New word" it counts to the next scheduled slot instead.
 */
export function AutoHintCountdown({ round }: { round: GameRound }) {
    const { serverOffset } = useRoom();
    const { t } = useTrans();
    const nextAt = nextAutoHintAt(
        round.startedAt,
        round.hintSeconds,
        hintsUsed(round.mask ?? []),
        round.maxHints ?? 0,
        round.hintSlots === undefined
            ? undefined
            : { hintSlots: round.hintSlots, now: Date.now() + serverOffset },
    );
    const remaining = useCountdown(
        nextAt === null ? null : new Date(nextAt).toISOString(),
        serverOffset,
    );

    if (remaining === null) {
        return null;
    }

    return (
        <span
            data-slot="auto-hint-countdown"
            className="text-xs whitespace-nowrap text-muted-foreground tabular-nums"
        >
            {remaining > 0
                ? t('next letter in :time', { time: formatSeconds(remaining) })
                : t('next letter now')}
        </span>
    );
}
