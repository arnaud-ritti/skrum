import { Check, Crown } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

type Props = { highlightPlayerId?: string | null };

export function PlayersList({ highlightPlayerId = null }: Props) {
    const { snapshot, online } = useRoom();
    const { t } = useTrans();
    const onlineIds = new Set(online.map((member) => member.id));
    const players = [...snapshot.players].sort(
        (first, second) =>
            Number(onlineIds.has(second.presenceId)) -
            Number(onlineIds.has(first.presenceId)),
    );

    return (
        <section aria-labelledby="game-players" className="space-y-2">
            <h2 id="game-players" className="text-sm font-semibold">
                {t('Players')}
            </h2>
            <ul className="space-y-1">
                {players.map((player) => (
                    <li
                        key={player.id}
                        className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-1',
                            !onlineIds.has(player.presenceId) && 'opacity-50',
                        )}
                    >
                        <img
                            src={player.avatarUrl}
                            alt=""
                            className="size-6 rounded-full bg-muted"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                            {player.name}
                            {player.isGuest && (
                                <span className="text-muted-foreground">
                                    {' '}
                                    {t('(guest)')}
                                </span>
                            )}
                        </span>
                        {player.id === snapshot.room.hostPlayerId && (
                            <Crown
                                className="size-4 text-amber-500"
                                aria-label={t('Host')}
                            />
                        )}
                        {player.id === highlightPlayerId && (
                            <Check
                                className="size-4 text-green-600"
                                aria-label={t('Winner')}
                            />
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
