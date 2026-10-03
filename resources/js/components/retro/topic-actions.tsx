import { Layers, Link2 } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { actionCountByTopic, topicLabel } from '@/lib/retro/topics';
import type { Topic } from '@/lib/retro/topics';
import type { ActionItem } from '@/lib/retro/types';
import { ActionItemsList } from './action-items-list';
import { useBoard } from './board-context';
import { useDiscussion } from './phase-discussing';

/** The topic an action item was created for, in its meta line (RT-8). */
export function ItemTopic({ item }: { item: ActionItem }) {
    const { topics } = useDiscussion();

    return <ItemTopicName topic={topicLabel(item, topics)} />;
}

/** The title of an item's topic, with its icon; nothing without a topic. */
export function ItemTopicName({ topic }: { topic: { title: string } | null }) {
    const { t } = useTrans();

    if (topic === null) {
        return null;
    }

    return (
        <span
            data-slot="retro-item-topic"
            className="inline-flex min-w-0 items-center gap-1"
        >
            <Layers className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{topic.title || t('GIF')}</span>
        </span>
    );
}

/** "1 linked action", ":count linked actions" on a topic card of the Actions phase. */
export function LinkedActionCount({ topic }: { topic: Topic }) {
    const { board } = useBoard();
    const { t } = useTrans();
    const count =
        actionCountByTopic(board.actionItems).get(topic.leadCardId) ?? 0;

    if (count === 0) {
        return null;
    }

    return (
        <span data-slot="retro-topic-actions-count" className="truncate">
            {count === 1
                ? t('1 linked action')
                : t(':count linked actions', { count })}
        </span>
    );
}

/** The line of the quick add of the Actions phase, linked to the shared topic. */
export function QuickAddLink({ topic }: { topic: Topic }) {
    const { t } = useTrans();

    return (
        <span className="truncate">
            {t('Quick add · linked to «:title»', {
                title: topic.title || t('GIF'),
            })}
        </span>
    );
}

/**
 * The action items of the topic in front of the viewer, with the form that
 * creates one linked to it; every other item of the retro stays one press
 * away, folded (RT-8, owner 2-D9). Without a topic, the plain list.
 */
export function TopicActions() {
    const { t } = useTrans();
    const { topics, current } = useDiscussion();

    if (current === null) {
        return <ActionItemsList />;
    }

    const rank = topics.findIndex((topic) => topic.id === current.id) + 1;
    const inTopic = (item: ActionItem): boolean =>
        item.cardId === current.leadCardId;

    return (
        <ActionItemsList
            title={t('Topic actions')}
            filter={inTopic}
            itemMeta={(item) =>
                inTopic(item) ? null : <ItemTopic item={item} />
            }
            linkedTo={{
                cardId: current.leadCardId,
                unlinkable: true,
                label: (
                    <>
                        <Link2 className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">
                            {t('Linked to #:rank · :title', {
                                rank,
                                title: current.title || t('GIF'),
                            })}
                        </span>
                    </>
                ),
            }}
        />
    );
}
