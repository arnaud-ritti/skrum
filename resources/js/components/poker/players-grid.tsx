import { Crown } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { PokerRound, PokerRoundVote } from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import { AnonymousValuesRow } from './anonymous-values-row';
import { useGame } from './game-context';
import { PokerCard } from './poker-card';
import { PlayerRoleMenu } from './spectator-toggle';
import { WatchingRow } from './watching-row';

/**
 * On an anonymous round the seats stay face-down after reveal (the viewer's
 * own seat too), so no seat links a value to a player.
 */
export function cardFace(
    round: PokerRound | null,
    vote: PokerRoundVote | undefined,
): 'empty' | 'down' | 'up' {
    if (round === null || vote === undefined) {
        return 'empty';
    }

    if (round.revealedAt === null || round.anonymous || vote.value === null) {
        return 'down';
    }

    return 'up';
}

/**
 * Seats at the table: online players plus anyone offline who already voted
 * in the current round, so a vote never disappears from the table.
 */
export function PlayersGrid() {
    const { snapshot, online } = useGame();
    const { t } = useTrans();
    const { game, current, players } = snapshot;

    if (!current) {
        return null;
    }

    const { round } = current;
    const onlineIds = new Set(online.map((member) => member.id));
    const votes = new Map(round.votes.map((vote) => [vote.playerId, vote]));
    const seated = players.filter(
        (player) =>
            !player.isSpectator &&
            (onlineIds.has(player.id) || votes.has(player.id)),
    );

    return (
        <section aria-label={t('Players')}>
            <ul className="flex flex-wrap justify-center gap-4">
                {seated.map((player) => {
                    const vote = votes.get(player.id);
                    const isOffline = !onlineIds.has(player.id);
                    const face = cardFace(round, vote);
                    const status = vote ? t('Voted') : t('Not voted yet');

                    return (
                        <li
                            key={player.id}
                            className={cn(
                                'flex w-20 flex-col items-center gap-2 text-center',
                                isOffline && 'opacity-50',
                            )}
                        >
                            <PokerCard
                                value={
                                    face === 'up' ? (vote?.value ?? null) : null
                                }
                                face={face}
                                label={`${player.name}: ${face === 'up' ? vote?.value : status}`}
                            />
                            <div className="flex max-w-full items-center gap-1">
                                <img
                                    src={player.avatarUrl}
                                    alt=""
                                    className="size-5 shrink-0 rounded-full bg-muted"
                                />
                                <span className="truncate text-xs">
                                    {player.name}
                                </span>
                                {game.facilitatorPlayerId === player.id && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Crown
                                                className="size-3 shrink-0 text-amber-500"
                                                aria-label={t('Facilitator')}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {t('Facilitator')}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                <PlayerRoleMenu player={player} />
                            </div>
                            {isOffline && (
                                <span className="text-xs text-muted-foreground">
                                    {t('Offline')}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
            {round.anonymous && round.revealedAt !== null && (
                <AnonymousValuesRow round={round} />
            )}
            <WatchingRow />
        </section>
    );
}
