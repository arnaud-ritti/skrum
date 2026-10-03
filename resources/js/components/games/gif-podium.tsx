import { Trophy } from 'lucide-react';
import { PersonAvatar } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import { isWinningAnswer, rankedAnswers } from '@/lib/games/gif';
import type { GameGifRevealed, GamePlayer } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';
import { useEndedGifAnswers } from './use-ended-gif-answers';

function votesLabel(
    votes: number,
    t: ReturnType<typeof useTrans>['t'],
): string {
    return votes === 1
        ? t(':count vote', { count: votes })
        : t(':count votes', { count: votes });
}

/**
 * The right column after the votes of Sprint in one GIF close: "This sprint's
 * GIF" with its winner, then the ranking of the others with ties. On an
 * anonymous retro the GIFs carry no author, so no name is shown.
 */
export function GifPodium({ className }: { className?: string }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const answers = useEndedGifAnswers();

    if (snapshot.round || answers === null || answers.length === 0) {
        return null;
    }

    const players = new Map<string, GamePlayer>(
        snapshot.players.map((player) => [player.id, player]),
    );
    const ranked = rankedAnswers(answers);
    const winners = ranked.filter(isWinningAnswer);
    const others = ranked.filter((answer) => !isWinningAnswer(answer));
    const [shown] = winners;
    const totalVotes = answers.reduce(
        (sum, answer) => sum + (answer.votes ?? 0),
        0,
    );
    const authorOf = (answer: GameGifRevealed): GamePlayer | null =>
        answer.playerId === null
            ? null
            : (players.get(answer.playerId) ?? null);
    const winnerNames = winners
        .map((answer) => authorOf(answer)?.name)
        .filter((name): name is string => name !== undefined);
    const shownAuthor = shown ? authorOf(shown) : null;

    return (
        <section
            data-slot="gif-podium"
            aria-labelledby="gif-podium-title"
            className={cn('flex min-w-0 flex-col gap-4', className)}
        >
            <h2 id="gif-podium-title" className="text-base font-title">
                {t("This sprint's GIF")}
            </h2>
            {shown ? (
                <div
                    data-slot="gif-podium-winner"
                    className="flex min-w-0 flex-col gap-3 rounded-xl border border-primary bg-card p-4 shadow-card"
                >
                    <div className="relative overflow-hidden rounded-lg">
                        <img
                            src={shown.gif.previewUrl}
                            alt={shown.caption ?? ''}
                            loading="lazy"
                            className="aspect-4/3 w-full bg-muted object-cover"
                        />
                        <span className="absolute top-2 left-2 inline-flex h-6 items-center gap-1 rounded-full bg-primary px-2 text-xs font-bold whitespace-nowrap text-primary-foreground">
                            <Trophy aria-hidden className="size-3.5" />
                            {t('Winner')}
                        </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                        {shownAuthor && (
                            <PersonAvatar
                                name={shownAuthor.name}
                                src={shownAuthor.avatarUrl}
                                kind={shownAuthor.isGuest ? 'guest' : 'member'}
                                size="md"
                                decorative
                            />
                        )}
                        <div className="flex min-w-0 flex-col">
                            {winnerNames.length > 0 && (
                                <p className="font-display text-lg font-bold break-words">
                                    {winnerNames.length === 1
                                        ? t(':name wins the round', {
                                              name: winnerNames[0],
                                          })
                                        : t(':names win the round', {
                                              names: winnerNames.join(', '),
                                          })}
                                </p>
                            )}
                            <span className="text-xs break-words text-muted-foreground">
                                {shown.caption
                                    ? `${t('“:caption”', { caption: shown.caption })} · `
                                    : ''}
                                {shown.votes === 1
                                    ? t(':count vote out of :total', {
                                          count: 1,
                                          total: totalVotes,
                                      })
                                    : t(':count votes out of :total', {
                                          count: shown.votes ?? 0,
                                          total: totalVotes,
                                      })}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {t('No GIF got a vote.')}
                </p>
            )}
            {others.length > 0 && (
                <div className="flex min-w-0 flex-col gap-1">
                    <h3
                        id="gif-ranking-title"
                        className="text-sm font-medium text-muted-foreground"
                    >
                        {t('Ranking')}
                    </h3>
                    <ol
                        data-slot="gif-ranking"
                        aria-labelledby="gif-ranking-title"
                        className="flex min-w-0 flex-col"
                    >
                        {others.map((answer) => {
                            const author = authorOf(answer);
                            const label =
                                author?.name ??
                                answer.caption ??
                                t('Anonymous GIF');

                            return (
                                <li
                                    key={answer.id}
                                    className="flex min-w-0 items-center gap-3 px-2 py-1.5 text-sm"
                                >
                                    <span className="w-4 shrink-0 text-right font-semibold tabular-nums">
                                        {answer.rank ?? '–'}
                                    </span>
                                    {author && (
                                        <PersonAvatar
                                            name={author.name}
                                            src={author.avatarUrl}
                                            kind={
                                                author.isGuest
                                                    ? 'guest'
                                                    : 'member'
                                            }
                                            size="xs"
                                            decorative
                                        />
                                    )}
                                    <span className="min-w-0 flex-1 truncate">
                                        {label}
                                    </span>
                                    <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
                                        {votesLabel(answer.votes ?? 0, t)}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}
        </section>
    );
}
