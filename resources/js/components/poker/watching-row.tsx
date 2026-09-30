import { useTrans } from '@/hooks/use-trans';
import { useGame } from './game-context';
import { PlayerRoleMenu } from './spectator-toggle';

export function WatchingRow() {
    const { snapshot, online } = useGame();
    const { t } = useTrans();
    const onlineIds = new Set(online.map((member) => member.id));
    const watchers = snapshot.players.filter(
        (player) => player.isSpectator && onlineIds.has(player.id),
    );

    if (watchers.length === 0) {
        return null;
    }

    return (
        <section aria-label={t('Watching')} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
                {t('Watching')}
            </h3>
            <ul className="flex flex-wrap gap-3">
                {watchers.map((player) => (
                    <li key={player.id} className="flex items-center gap-2">
                        <img
                            src={player.avatarUrl}
                            alt=""
                            className="size-6 rounded-full bg-muted"
                        />
                        <span className="text-sm">{player.name}</span>
                        <PlayerRoleMenu player={player} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
