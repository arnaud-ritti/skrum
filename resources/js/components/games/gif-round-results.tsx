import { Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { GameGifRevealed, GamePointsAward } from '@/lib/games/types';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

type Props = { answers: GameGifRevealed[]; points?: GamePointsAward[] };

/** The gallery of a closed round: the most voted first, with the mark of the winner. */
export function GifRoundResults({ answers, points = [] }: Props) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const players = new Map(
        snapshot.players.map((player) => [player.id, player]),
    );
    const earned = new Map(
        points.map((award) => [award.playerId, award.points]),
    );
    const ranked = [...answers].sort(
        (first, second) => (second.votes ?? 0) - (first.votes ?? 0),
    );
    const topVotes = ranked[0]?.votes ?? 0;

    if (ranked.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">{t('No GIFs yet.')}</p>
        );
    }

    return (
        <ul
            data-slot="gif-results"
            className="grid w-full grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] items-start gap-4"
        >
            {ranked.map((answer) => {
                const player =
                    answer.playerId === null
                        ? null
                        : (players.get(answer.playerId) ?? null);
                const author =
                    answer.playerId === null
                        ? null
                        : (player?.name ?? t('Someone'));
                const gained =
                    answer.playerId === null
                        ? 0
                        : (earned.get(answer.playerId) ?? 0);

                return (
                    <li key={answer.id} className="min-w-0">
                        <GifTile
                            gif={answer.gif}
                            caption={
                                author === null
                                    ? t('Anonymous GIF')
                                    : t('by :name', { name: author })
                            }
                            author={player}
                            winner={topVotes > 0 && answer.votes === topVotes}
                        >
                            <div className="flex min-h-5.5 items-center justify-between gap-2 text-xs">
                                <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                                    {typeof answer.votes === 'number' && (
                                        <>
                                            <Heart
                                                aria-hidden
                                                className="size-3.5 shrink-0"
                                            />
                                            <span className="truncate">
                                                {t('Votes: :count', {
                                                    count: answer.votes,
                                                })}
                                            </span>
                                        </>
                                    )}
                                </span>
                                {gained > 0 && (
                                    <Badge variant="success" shape="pill">
                                        +{gained}
                                    </Badge>
                                )}
                            </div>
                        </GifTile>
                    </li>
                );
            })}
        </ul>
    );
}
