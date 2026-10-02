import { Crosshair } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/skrum/empty-state';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { Topic } from '@/lib/retro/topics';
import type {
    ActionItem as ActionItemPayload,
    BoardCard,
    ColumnColor,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { ActionItemsList } from './action-items-list';
import { useBoard } from './board-context';
import { BoardCursors } from './board-cursors';
import { CarriedItemRows, showsCarriedItems } from './carried-items-sheet';
import { useDiscussion } from './phase-discussing';
import { SuggestionsPanel } from './suggestions-panel';
import { topicColor, TopicVotes } from './topics-list';

/**
 * What a topic says under its title: the first card of a named group. A card
 * alone, or a group without a name, already has its text as its title.
 */
export function topicExcerpt(
    topic: Pick<Topic, 'leadCardId'>,
    cards: Pick<BoardCard, 'id' | 'groupName' | 'content'>[],
): string | null {
    const lead = cards.find((card) => card.id === topic.leadCardId);

    if (!lead || (lead.groupName ?? '').trim() === '') {
        return null;
    }

    return lead.content?.trim() || null;
}

type TopicCardProps = {
    topic: Topic;
    rank: number;
    color: ColumnColor;
    excerpt: string | null;
    focused: boolean;
    /** Left out, the card is not a control: only the facilitator moves the room. */
    onSelect?: () => void;
    disabled?: boolean;
    meta?: ReactNode;
};

function TopicCard({
    topic,
    rank,
    color,
    excerpt,
    focused,
    onSelect,
    disabled = false,
    meta,
}: TopicCardProps) {
    const { t } = useTrans();
    const className = cn(
        columnColorClass(color),
        'flex w-full min-w-0 flex-col gap-2 rounded-lg border border-(--col-border) bg-(--col) p-3 text-left text-foreground shadow-card',
        focused && 'ring-2 ring-skrum-info',
        onSelect &&
            'outline-ring transition-shadow duration-140 ease-standard hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none',
    );
    const body = (
        <>
            <span className="flex min-w-0 items-start gap-2">
                <span className="shrink-0 font-mono text-xs/5 font-semibold text-(--col-text)">
                    #{rank}
                </span>
                <span
                    data-slot="retro-topic-title"
                    className="line-clamp-3 min-w-0 flex-1 text-sm font-semibold wrap-anywhere"
                >
                    {topic.title || t('GIF')}
                </span>
                <span className="inline-flex h-5 shrink-0 items-center">
                    <TopicVotes votes={topic.votes} />
                </span>
            </span>
            {excerpt && (
                <span className="line-clamp-3 min-w-0 text-body-sm wrap-anywhere text-muted-foreground">
                    {excerpt}
                </span>
            )}
            {(focused || meta) && (
                <span className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    {focused && (
                        <Badge
                            variant="info"
                            shape="pill"
                            className="max-w-full min-w-0"
                        >
                            <Crosshair aria-hidden />
                            <span className="truncate">
                                {t('In discussion')}
                            </span>
                        </Badge>
                    )}
                    {meta}
                </span>
            )}
        </>
    );

    if (!onSelect) {
        return (
            <div data-slot="retro-actions-topic" className={className}>
                {body}
            </div>
        );
    }

    return (
        <button
            type="button"
            data-slot="retro-actions-topic"
            aria-pressed={focused}
            disabled={disabled}
            className={className}
            onClick={onSelect}
        >
            {body}
        </button>
    );
}

type Props = {
    hideMyCursor: boolean;
    /** Place of "Export to Jira", in the header of the actions card (RT-10). */
    exportAll?: ReactNode;
    /** Place of the count of actions of a topic, on its card (RT-8). */
    topicMeta?: (topic: Topic) => ReactNode;
    /** Place of the topic a new action item is linked to (RT-8). */
    linkedTo?: ReactNode;
    /** Place of the topic an action item belongs to, in its row (RT-8). */
    itemTopic?: (item: ActionItemPayload) => ReactNode;
};

/**
 * Actions: the topics by votes on the left, the one in focus marked for
 * everyone, and on the right what the room commits to.
 */
export function PhaseActions({
    hideMyCursor,
    exportAll,
    topicMeta,
    linkedTo,
    itemTopic,
}: Props) {
    const { board } = useBoard();
    const { t } = useTrans();
    const { topics, shared, busy, goTo } = useDiscussion();
    const [stage, setStage] = useState<HTMLElement | null>(null);
    const titleId = useId();
    const { isFacilitator } = board.viewer;
    const carried = showsCarriedItems(board) ? board.carriedActionItems : [];

    return (
        <div
            ref={setStage}
            data-slot="retro-actions"
            className="relative grid min-w-0 grid-cols-1 content-start gap-6 px-4 pt-5 md:px-6 lg:grid-cols-[minmax(0,26.25rem)_minmax(0,1fr)]"
        >
            <section
                aria-labelledby={titleId}
                data-slot="retro-actions-topics"
                className="flex min-w-0 flex-col gap-2"
            >
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <h2
                        id={titleId}
                        className="min-w-0 truncate text-lg font-title"
                    >
                        {t('Most voted topics')}
                    </h2>
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {t('Sorted by votes')}
                    </span>
                </div>
                {topics.length === 0 ? (
                    <EmptyState
                        module="retro"
                        illustration={false}
                        title={t('No topics to discuss.')}
                        description={t('Nobody wrote a card in this retro.')}
                    />
                ) : (
                    <ol
                        data-test="retro-topics"
                        className="flex min-w-0 flex-col gap-2"
                    >
                        {topics.map((topic, index) => {
                            const focused = topic.id === shared?.id;

                            return (
                                <li
                                    key={topic.id}
                                    data-topic-id={topic.id}
                                    data-shared={focused || undefined}
                                    aria-current={focused ? 'true' : undefined}
                                    className="min-w-0"
                                >
                                    <TopicCard
                                        topic={topic}
                                        rank={index + 1}
                                        color={topicColor(topic, board.columns)}
                                        excerpt={topicExcerpt(
                                            topic,
                                            board.cards,
                                        )}
                                        focused={focused}
                                        disabled={busy}
                                        onSelect={
                                            isFacilitator
                                                ? () => goTo(topic)
                                                : undefined
                                        }
                                        meta={topicMeta?.(topic)}
                                    />
                                </li>
                            );
                        })}
                    </ol>
                )}
            </section>
            <div
                data-slot="retro-actions-panels"
                className="flex min-w-0 flex-col gap-4"
            >
                <ActionItemsList
                    variant="phase"
                    headerActions={exportAll}
                    linkedTo={linkedTo}
                    itemMeta={itemTopic}
                    more={
                        carried.length > 0
                            ? {
                                  count: carried.length,
                                  node: (
                                      <CarriedItemRows
                                          items={carried}
                                          idPrefix="carried-item-"
                                          showSource
                                      />
                                  ),
                              }
                            : undefined
                    }
                />
                <SuggestionsPanel />
            </div>
            <BoardCursors container={stage} hidden={hideMyCursor} />
        </div>
    );
}
