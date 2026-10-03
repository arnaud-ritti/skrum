import { CircleCheck, Crosshair } from 'lucide-react';
import { useCountdown, useServerOffset } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import {
    estimateMinutesLabel,
    topicEstimateSeconds,
} from '@/lib/retro/topic-estimate';
import { actionCountByTopic } from '@/lib/retro/topics';
import type { Topic } from '@/lib/retro/topics';
import { useBoard } from './board-context';
import { useDiscussion } from './phase-discussing';

/** "04:12": the minutes on two digits, as the topics list of the mockup. */
function clock(seconds: number): string {
    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');

    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * What is left of the shared topic's time: the retro's timer while a time
 * per topic is set, its paused seconds while paused; null without either.
 * `counts` false keeps the countdown idle, for a row that is not the
 * shared topic.
 */
function useSharedTopicRemaining(counts = true): number | null {
    const { board } = useBoard();
    const { timerEndsAt, timerPausedSeconds, topicSeconds } = board.retro;
    const offset = useServerOffset(board.serverTime);
    const isTopicTimer = counts && topicSeconds !== null;
    const isPaused = timerPausedSeconds !== null;
    const remaining = useCountdown(
        isTopicTimer && !isPaused ? timerEndsAt : null,
        offset,
    );

    if (!isTopicTimer) {
        return null;
    }

    return isPaused ? timerPausedSeconds : remaining;
}

function discussedIdsOf(
    topics: Topic[],
    cards: { id: string; discussedAt: string | null }[],
): Set<string> {
    const discussed = new Set(
        cards
            .filter((card) => card.discussedAt !== null)
            .map((card) => card.id),
    );

    return new Set(
        topics
            .filter((topic) => discussed.has(topic.leadCardId))
            .map((topic) => topic.id),
    );
}

/**
 * The second line of a topic in the list (RT-5, RT-7, RT-8): the shared
 * topic and the time left on it, a discussed topic and its action items,
 * or the count of action items of any other topic.
 */
export function TopicMeta({ topic }: { topic: Topic }) {
    const { board } = useBoard();
    const { t } = useTrans();
    const { shared } = useDiscussion();
    const isShared = shared?.id === topic.id;
    const remaining = useSharedTopicRemaining(isShared);
    const actions =
        actionCountByTopic(board.actionItems).get(topic.leadCardId) ?? 0;
    const lead = board.cards.find((card) => card.id === topic.leadCardId);

    if (isShared) {
        return (
            <span
                data-slot="retro-topic-meta"
                data-state="now"
                className="inline-flex min-w-0 items-center gap-1 font-medium text-skrum-primary-text"
            >
                <Crosshair className="size-3 shrink-0" aria-hidden />
                <span className="truncate">
                    {remaining === null
                        ? t('Now')
                        : t('Now · :time left', { time: clock(remaining) })}
                </span>
            </span>
        );
    }

    if (lead?.discussedAt) {
        return (
            <span
                data-slot="retro-topic-meta"
                data-state="discussed"
                className="inline-flex min-w-0 items-center gap-1 font-medium text-skrum-success-text"
            >
                <CircleCheck className="size-3 shrink-0" aria-hidden />
                <span className="truncate">
                    {actions === 0
                        ? t('Discussed')
                        : actions === 1
                          ? t('Discussed · 1 action')
                          : t('Discussed · :count actions', {
                                count: actions,
                            })}
                </span>
            </span>
        );
    }

    if (actions === 0) {
        return null;
    }

    return (
        <span
            data-slot="retro-topic-meta"
            data-state="idle"
            className="truncate"
        >
            {actions === 1
                ? t('1 action')
                : t(':count actions', { count: actions })}
        </span>
    );
}

/** "~ 20 min left" in the footer of the topics list; nothing without a time per topic. */
export function DiscussionEstimate() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { topics, shared } = useDiscussion();
    const remaining = useSharedTopicRemaining();
    const seconds = topicEstimateSeconds({
        topics,
        sharedId: shared?.id ?? null,
        discussedIds: discussedIdsOf(topics, board.cards),
        topicSeconds: board.retro.topicSeconds,
        sharedRemaining: remaining,
    });

    if (seconds === null) {
        return null;
    }

    return (
        <span
            data-slot="retro-discussion-estimate"
            className="truncate text-muted-foreground"
        >
            {estimateMinutesLabel(seconds, t)}
        </span>
    );
}

/**
 * The last line of the topics list: "5 min per topic · 3 actions so far"
 * with a time per topic, "3 actions so far" without one.
 */
export function DiscussionPace() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { topicSeconds } = board.retro;
    const count = board.actionItems.length;

    if (topicSeconds === null) {
        return count === 1
            ? t('1 action so far')
            : t(':count actions so far', { count });
    }

    const minutes = Math.ceil(topicSeconds / 60);

    return count === 1
        ? t(':minutes min per topic · 1 action so far', { minutes })
        : t(':minutes min per topic · :count actions so far', {
              minutes,
              count,
          });
}

/** "5 min" in "Up next": the time the topic will get; nothing without one. */
export function TopicTime() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { topicSeconds } = board.retro;

    if (topicSeconds === null) {
        return null;
    }

    return (
        <span
            data-slot="retro-topic-time"
            className="shrink-0 whitespace-nowrap text-muted-foreground"
        >
            {t(':count min', { count: Math.ceil(topicSeconds / 60) })}
        </span>
    );
}
