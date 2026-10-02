import { Layers, StickyNote, ThumbsUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { useTrans } from '@/hooks/use-trans';
import type { Topic } from '@/lib/retro/topics';
import { cn } from '@/lib/utils';
import { BoardCard } from './board-card';
import { useBoard } from './board-context';
import { BoardGroup } from './board-group';
import { topicColor, TopicSwatch, TopicVotes } from './topics-list';

/**
 * The cards of the topic are drawn larger than on the board, side by side
 * when the stage has the room.
 */
const FocusedCardsClass = cn(
    '**:data-[slot=card-group]:gap-3 **:data-[slot=card-group]:p-4 **:data-[slot=card-group]:shadow-raised',
    '**:data-[slot=card-group-title]:h-auto **:data-[slot=card-group-title]:text-xl',
    '**:data-[slot=card-group-stack]:grid **:data-[slot=card-group-stack]:grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] **:data-[slot=card-group-stack]:gap-3',
    '**:data-[slot=retro-card]:h-full **:data-[slot=retro-card]:p-4',
    '**:data-[slot=retro-card-text]:text-base',
);

type Props = {
    topic: Topic;
    /** Its place in the list, from 1. */
    rank: number;
    className?: string;
};

/**
 * The topic in front of the viewer: its group or its card, with every
 * control it had on the board and the same ids.
 */
export function TopicFocus({ topic, rank, className }: Props) {
    const { board } = useBoard();
    const { t } = useTrans();
    const lead = board.cards.find((card) => card.id === topic.leadCardId);
    const column = board.columns.find(
        (candidate) => candidate.id === topic.columnId,
    );

    if (!lead) {
        return null;
    }

    const color = topicColor(topic, board.columns);
    const cardCount = topic.cardIds.length;
    const isGroup = cardCount > 1;
    const title = topic.title || t('GIF');
    const votesLabel = t(topic.votes === 1 ? ':count vote' : ':count votes', {
        count: topic.votes,
    });
    const cardsLabel = t(cardCount === 1 ? ':count card' : ':count cards', {
        count: cardCount,
    });
    const columnTitle = column?.title ?? '';
    const Origin = isGroup ? Layers : StickyNote;

    return (
        <section
            data-slot="retro-topic-focus"
            data-topic-id={topic.id}
            aria-label={t('Topic in focus: :title, :cards, :votes', {
                title,
                cards: cardsLabel,
                votes: votesLabel,
            })}
            className={cn(
                columnColorClass(color),
                FocusedCardsClass,
                'flex min-w-0 flex-col gap-3',
                className,
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <span
                    data-slot="retro-topic-rank"
                    className="shrink-0 rounded-sm border border-(--col-border) bg-card px-1.5 font-mono text-body-sm/6 font-bold text-(--col-text)"
                >
                    #{rank}
                </span>
                <span className="inline-flex min-w-0 flex-1 basis-40 items-center gap-2 text-xs text-muted-foreground">
                    <Origin className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 wrap-anywhere">
                        {isGroup
                            ? t('Group of :count cards · column “:column”', {
                                  count: cardCount,
                                  column: columnTitle,
                              })
                            : t('Column “:column”', { column: columnTitle })}
                    </span>
                </span>
                <span
                    data-slot="retro-topic-total"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-(--col-border) bg-card px-3 text-sm font-bold whitespace-nowrap"
                >
                    <ThumbsUp
                        className="size-4 text-(--col-text)"
                        aria-hidden
                    />
                    {votesLabel}
                </span>
            </div>
            {isGroup ? <BoardGroup lead={lead} /> : <BoardCard card={lead} />}
        </section>
    );
}

/** What comes after the topic in focus. */
export function TopicUpNext({
    topic,
    rank,
    estimate,
}: {
    topic: Topic;
    rank: number;
    /** Place of the time planned for the topic (RT-5). */
    estimate?: ReactNode;
}) {
    const { board } = useBoard();
    const { t } = useTrans();
    const cardCount = topic.cardIds.length;

    return (
        <div
            data-slot="retro-topic-next"
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-input bg-card/70 px-4 py-2.5 text-body-sm"
        >
            <span className="shrink-0 text-overline text-muted-foreground uppercase">
                {t('Up next')}
            </span>
            <span className="inline-flex min-w-0 flex-1 basis-32 items-center gap-2">
                <TopicSwatch
                    color={topicColor(topic, board.columns)}
                    className="size-2.5"
                />
                <span className="truncate font-semibold">
                    #{rank} · {topic.title || t('GIF')}
                </span>
            </span>
            <span className="shrink-0 text-muted-foreground">
                {t(cardCount === 1 ? ':count card' : ':count cards', {
                    count: cardCount,
                })}
            </span>
            {estimate}
            <TopicVotes votes={topic.votes} />
        </div>
    );
}
