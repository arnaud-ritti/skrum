import { PersonAvatar } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

/** Players and their points on one line, for a phone: the full lists are in the side sheet. */
export function PlayerChips() {
    const { snapshot, online } = useRoom();
    const { t } = useTrans();
    const onlineIds = new Set(online.map((member) => member.id));
    const points = new Map(
        snapshot.leaderboard.map((row) => [row.playerId, row.points]),
    );
    const players = snapshot.players
        .filter((player) => onlineIds.has(player.presenceId))
        .sort(
            (first, second) =>
                (points.get(second.id) ?? 0) - (points.get(first.id) ?? 0),
        );

    return (
        <ul
            data-slot="player-chips"
            aria-label={t('Players')}
            className="flex min-w-0 gap-2 overflow-x-auto py-0.5"
        >
            {players.map((player) => {
                const isMe = player.id === snapshot.me.playerId;

                return (
                    <li
                        key={player.id}
                        className={cn(
                            'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card py-0 pr-2.5 pl-1 text-body-sm font-semibold',
                            isMe &&
                                'border-primary ring-1 ring-primary ring-inset',
                        )}
                    >
                        <PersonAvatar
                            name={player.name}
                            src={player.avatarUrl}
                            kind={player.isGuest ? 'guest' : 'member'}
                            size="sm"
                            decorative
                        />
                        <span className="max-w-24 truncate">
                            {isMe ? t('You') : player.name.split(' ')[0]}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                            {points.get(player.id) ?? 0}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
