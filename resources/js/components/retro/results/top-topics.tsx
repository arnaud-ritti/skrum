import { ThumbsUp } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { childrenOf, sortByVotes } from '@/lib/retro/board-reducer';
import { useBoard } from '../board-context';
import { ResultsCard } from './results-card';

const TopicsShown = 5;

/** The five cards or groups with the most votes. */
export function TopTopics() {
    const { board } = useBoard();
    const { t } = useTrans();
    const topCards = sortByVotes(
        board.cards.filter((card) => card.parentCardId === null),
    ).slice(0, TopicsShown);

    return (
        <ResultsCard title={t('Top topics')}>
            {topCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('Nobody wrote a card in this retro.')}
                </p>
            ) : (
                <ol className="flex min-w-0 flex-col gap-2">
                    {topCards.map((card) => {
                        const groupedCount = childrenOf(
                            board.cards,
                            card.id,
                        ).length;
                        const votes = card.votes ?? 0;

                        return (
                            <li
                                key={card.id}
                                className="flex min-w-0 items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                            >
                                <div className="flex min-w-0 flex-col gap-1">
                                    {card.groupName && (
                                        <p className="font-semibold wrap-anywhere">
                                            {card.groupName}
                                        </p>
                                    )}
                                    {card.content === null && card.gif ? (
                                        <img
                                            src={card.gif.previewUrl}
                                            alt={t('GIF')}
                                            loading="lazy"
                                            className="h-auto max-h-16 w-auto max-w-full self-start rounded-sm object-contain"
                                        />
                                    ) : (
                                        <p className="wrap-anywhere">
                                            {card.content}
                                        </p>
                                    )}
                                    {groupedCount > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            {t(
                                                groupedCount === 1
                                                    ? ':count grouped card'
                                                    : ':count grouped cards',
                                                { count: groupedCount },
                                            )}
                                        </p>
                                    )}
                                </div>
                                <span
                                    role="img"
                                    aria-label={t(
                                        votes === 1
                                            ? ':count vote'
                                            : ':count votes',
                                        { count: votes },
                                    )}
                                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-muted-foreground tabular-nums"
                                >
                                    <ThumbsUp
                                        className="size-3.5"
                                        aria-hidden
                                    />
                                    {votes}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </ResultsCard>
    );
}
