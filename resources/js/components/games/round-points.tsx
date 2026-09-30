import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { GamePointsAward } from '@/lib/games/types';
import { useRoom } from './room-context';

export function RoundPoints({ points }: { points: GamePointsAward[] }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );
    const scored = points.filter((award) => award.points > 0);

    if (scored.length === 0) {
        return null;
    }

    return (
        <ul
            className="flex flex-wrap justify-center gap-2"
            aria-label={t('Points of this round')}
        >
            {scored.map((award) => (
                <li key={award.playerId}>
                    <Badge variant="secondary">
                        {t('+:points :name', {
                            points: award.points,
                            name: names.get(award.playerId) ?? t('Someone'),
                        })}
                    </Badge>
                </li>
            ))}
        </ul>
    );
}
