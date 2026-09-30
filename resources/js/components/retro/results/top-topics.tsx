import { useTrans } from '@/hooks/use-trans';
import { childrenOf, sortByVotes } from '@/lib/retro/board-reducer';
import { useBoard } from '../board-context';
import { ResultsSection } from './results-section';

export function TopTopics() {
    const { board } = useBoard();
    const { t } = useTrans();
    const topCards = sortByVotes(
        board.cards.filter((card) => card.parentCardId === null),
    ).slice(0, 5);

    return (
        <ResultsSection title={t('Top topics')}>
            <ol className="space-y-2">
                {topCards.map((card) => {
                    const groupedCount = childrenOf(
                        board.cards,
                        card.id,
                    ).length;

                    return (
                        <li
                            key={card.id}
                            className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm"
                        >
                            <div className="min-w-0 space-y-1">
                                {card.groupName && (
                                    <p className="font-semibold">
                                        {card.groupName}
                                    </p>
                                )}
                                {card.content === null && card.gif ? (
                                    <img
                                        src={card.gif.previewUrl}
                                        alt={t('GIF')}
                                        loading="lazy"
                                        className="h-16 w-auto rounded-sm"
                                    />
                                ) : (
                                    <p className="break-words">
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
                            <span className="shrink-0 font-medium tabular-nums">
                                {card.votes ?? 0}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </ResultsSection>
    );
}
