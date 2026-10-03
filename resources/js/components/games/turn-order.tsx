import { ChevronRight } from 'lucide-react';
import { PersonAvatar } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import { nextLeaderId } from '@/lib/games/rotation';
import { nextInTurn, turnStates, turnsWrap } from '@/lib/games/turns';
import type { GameKind } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

type Order = {
    order: string[];
    current: string | null;
    next: string | null;
};

function orderHeading(
    game: GameKind,
    t: ReturnType<typeof useTrans>['t'],
): string {
    if (game === 'draw') {
        return t('Drawing order');
    }

    if (game === 'two_truths') {
        return t('Order of tellers');
    }

    return t('Speaking order');
}

/** The leader games that pass the lead round the online players. */
const RotationGames: GameKind[] = ['draw', 'two_truths'];

/**
 * Who plays, in order (spec §9.3): the round's own order for the games in
 * turns, the rotation of the online players for Draw & Guess and Two truths;
 * nothing for the other games.
 */
function useTurnOrder(): Order | null {
    const { snapshot, online, lastEnded } = useRoom();
    const { room, round, players, history } = snapshot;

    if (round !== null && round.turnOrder.length > 0) {
        return {
            order: round.turnOrder,
            current: round.turnPlayerId,
            next: nextInTurn(
                round.turnOrder,
                round.turnPlayerId,
                turnsWrap(round.game),
            ),
        };
    }

    if (!RotationGames.includes(room.game)) {
        return null;
    }

    const onlineIds = new Set(online.map((member) => member.id));
    const leaderId =
        round !== null && round.game === room.game
            ? round.leaderPlayerId
            : null;
    const previousLeaderId =
        leaderId ??
        lastEnded?.leaderPlayerId ??
        history[0]?.leaderPlayerId ??
        null;

    return {
        order: players
            .filter(
                (player) =>
                    onlineIds.has(player.presenceId) || player.id === leaderId,
            )
            .map((player) => player.id),
        current: leaderId,
        next: nextLeaderId(players, onlineIds, previousLeaderId),
    };
}

export function TurnOrder() {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const turnOrder = useTurnOrder();
    const { room, round, players } = snapshot;

    if (turnOrder === null || turnOrder.order.length === 0) {
        return null;
    }

    const names = new Map(players.map((player) => [player.id, player]));
    const seconds = round?.turnSeconds ?? room.settings.turnSeconds;
    const next =
        turnOrder.next === null ? null : (names.get(turnOrder.next) ?? null);
    const footer = [
        next === null ? null : t('Next: :name', { name: next.name }),
        seconds === null ? null : t(':seconds s per turn', { seconds }),
    ]
        .filter((part) => part !== null)
        .join(' · ');
    const heading = orderHeading(round?.game ?? room.game, t);

    return (
        <div
            data-slot="turn-order"
            className="flex flex-col gap-2 border-t pt-5"
        >
            <h3 className="text-sm font-title">{heading}</h3>
            <ol
                aria-label={heading}
                className="flex flex-wrap items-center gap-1.5"
            >
                {turnStates(turnOrder.order, turnOrder.current).map(
                    ({ playerId, state }, index) => {
                        const player = names.get(playerId);

                        return (
                            <li
                                key={playerId}
                                data-state={state}
                                aria-current={
                                    state === 'current' ? 'step' : undefined
                                }
                                className="flex items-center gap-1.5"
                            >
                                {index > 0 && (
                                    <ChevronRight
                                        aria-hidden
                                        className="size-3 shrink-0 text-muted-foreground"
                                    />
                                )}
                                <span
                                    className={cn(
                                        'flex rounded-full',
                                        state === 'current' &&
                                            'ring-2 ring-primary ring-offset-2 ring-offset-card',
                                        state === 'past' && 'opacity-50',
                                    )}
                                >
                                    <PersonAvatar
                                        name={player?.name ?? t('Someone')}
                                        src={player?.avatarUrl}
                                        kind={
                                            player?.isGuest ? 'guest' : 'member'
                                        }
                                        size="sm"
                                    />
                                </span>
                            </li>
                        );
                    },
                )}
            </ol>
            {footer !== '' && (
                <p className="text-xs text-muted-foreground">{footer}</p>
            )}
        </div>
    );
}
