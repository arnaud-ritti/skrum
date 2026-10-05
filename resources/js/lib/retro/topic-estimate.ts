import type { Translate } from '@/hooks/use-trans';
import type { Topic } from './topics';

/**
 * Time left for the discussion: what remains of the shared topic, and a
 * full time per topic for every other topic not yet discussed.
 */
export function topicEstimateSeconds({
    topics,
    sharedId,
    discussedIds,
    topicSeconds,
    sharedRemaining,
}: {
    topics: Topic[];
    sharedId: string | null;
    discussedIds: Set<string>;
    topicSeconds: number | null;
    sharedRemaining: number | null;
}): number | null {
    if (topicSeconds === null) {
        return null;
    }

    return topics.reduce((total, topic) => {
        if (discussedIds.has(topic.id)) {
            return total;
        }

        if (topic.id === sharedId && sharedRemaining !== null) {
            return total + sharedRemaining;
        }

        return total + topicSeconds;
    }, 0);
}

export function estimateMinutesLabel(seconds: number, t: Translate): string {
    if (seconds < 60) {
        return t('< 1 min left');
    }

    return t('~ :count min left', { count: Math.ceil(seconds / 60) });
}
