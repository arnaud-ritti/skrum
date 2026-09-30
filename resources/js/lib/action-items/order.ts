import type { ActionItem, ActionItemPriority } from '@/lib/retro/types';

const PriorityRank: Record<ActionItemPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
};

/**
 * Mirrors the server ordering: completed last, overdue first, then due
 * date, priority and newest first.
 */
export function compareActionItems(a: ActionItem, b: ActionItem): number {
    const aCompleted = a.status === 'completed';
    const bCompleted = b.status === 'completed';

    if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
    }

    if (!aCompleted) {
        if (a.isOverdue !== b.isOverdue) {
            return a.isOverdue ? -1 : 1;
        }

        if (a.dueOn !== b.dueOn) {
            if (a.dueOn === null) {
                return 1;
            }

            if (b.dueOn === null) {
                return -1;
            }

            return a.dueOn < b.dueOn ? -1 : 1;
        }

        if (a.priority !== b.priority) {
            return PriorityRank[a.priority] - PriorityRank[b.priority];
        }
    }

    if (a.createdAt !== b.createdAt) {
        return (b.createdAt ?? '') < (a.createdAt ?? '') ? -1 : 1;
    }

    return a.id < b.id ? -1 : 1;
}
