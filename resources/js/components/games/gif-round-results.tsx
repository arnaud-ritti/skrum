import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { GameGifRevealed, GamePointsAward } from '@/lib/games/types';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

type Props = { answers: GameGifRevealed[]; points?: GamePointsAward[] };

export function GifRoundResults({ answers, points = [] }: Props) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );
    const earned = new Map(
        points.map((award) => [award.playerId, award.points]),
    );
    const ranked = [...answers].sort(
        (first, second) => (second.votes ?? 0) - (first.votes ?? 0),
    );

    if (ranked.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">{t('No GIFs yet.')}</p>
        );
    }

    return (
        <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
            {ranked.map((answer) => {
                const author =
                    answer.playerId === null
                        ? null
                        : (names.get(answer.playerId) ?? t('Someone'));
                const gained =
                    answer.playerId === null
                        ? 0
                        : (earned.get(answer.playerId) ?? 0);

                return (
                    <li key={answer.id}>
                        <GifTile
                            gif={answer.gif}
                            caption={
                                author === null
                                    ? t('Anonymous GIF')
                                    : t('by :name', { name: author })
                            }
                        >
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {typeof answer.votes === 'number' &&
                                        t('Votes: :count', {
                                            count: answer.votes,
                                        })}
                                </span>
                                {gained > 0 && (
                                    <Badge variant="secondary">+{gained}</Badge>
                                )}
                            </div>
                        </GifTile>
                    </li>
                );
            })}
        </ul>
    );
}
