import { Timer } from '@/components/skrum/timer';
import { useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { useRoom } from './room-context';

const LowThresholdSeconds = 10;

/**
 * The deadline the server set for the turn in play (spec §6.4): a player's
 * turn in the games played in turns, else the round, which is its own turn.
 */
export function TurnTimer({ round }: { round: GameRound }) {
    const { snapshot, serverOffset } = useRoom();
    const { t } = useTrans();
    const remaining = useCountdown(round.turnEndsAt, serverOffset);

    if (round.turnEndsAt === null || remaining === null) {
        return null;
    }

    const turnPlayer = snapshot.players.find(
        (player) => player.id === round.turnPlayerId,
    );
    const caption =
        round.turnOrder.length > 0 && turnPlayer
            ? t(":name's turn", { name: turnPlayer.name })
            : t('left this turn');

    return (
        <div
            data-slot="turn-timer"
            className="flex min-w-0 shrink-0 items-center gap-2"
        >
            <span className="min-w-0 truncate text-sm text-muted-foreground">
                {caption}
            </span>
            <Timer
                remainingSeconds={remaining}
                totalSeconds={round.turnSeconds ?? undefined}
                size="lg"
                lowThresholdSeconds={LowThresholdSeconds}
            />
        </div>
    );
}
