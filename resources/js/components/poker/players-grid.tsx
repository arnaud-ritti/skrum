import { Crown } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { PokerCard } from './poker-card';

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
    const isRevealed = round.revealedAt !== null;

    return (
        <section aria-label={t('Players')}>
            <ul className="flex flex-wrap justify-center gap-4">
                {seated.map((player) => {
                    const vote = votes.get(player.id);
                    const isOffline = !onlineIds.has(player.id);
                    const face = !vote
                        ? 'empty'
                        : isRevealed && vote.value !== null
                          ? 'up'
                          : 'down';
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
        </section>
    );
}
