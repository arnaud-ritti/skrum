import { assigneeValue } from '@/lib/action-items/assignees';
import type { ActionItem, ActionItemAssignee } from '@/lib/retro/types';

export type ActionItemGrouping = 'team' | 'assignee' | 'none';

/** In the order of the control: the mockup ends on "None". */
export const ActionItemGroupings: ActionItemGrouping[] = [
    'team',
    'assignee',
    'none',
];

export type ActionItemGroup = {
    key: string;
    label: string;
    items: ActionItem[];
};

export type ActionItemGroupLabels = {
    team: (teamId: string) => string;
    assignee: (assignee: ActionItemAssignee | null) => string;
};

export function isActionItemGrouping(
    value: unknown,
): value is ActionItemGrouping {
    return ActionItemGroupings.some((grouping) => grouping === value);
}

/**
 * The rows of the current page under one header per team or per assignee.
 * Groups come in the order of their first row and keep the order the server
 * gave to the rows; "none" is one group without a label.
 */
export function groupItems(
    items: ActionItem[],
    by: ActionItemGrouping,
    labels: ActionItemGroupLabels,
): ActionItemGroup[] {
    if (items.length === 0) {
        return [];
    }

    if (by === 'none') {
        return [{ key: 'all', label: '', items }];
    }

    const groups = new Map<string, ActionItemGroup>();

    for (const item of items) {
        const key = by === 'team' ? item.teamId : assigneeValue(item.assignee);
        const group = groups.get(key);

        if (group) {
            group.items.push(item);

            continue;
        }

        groups.set(key, {
            key,
            label:
                by === 'team'
                    ? labels.team(item.teamId)
                    : labels.assignee(item.assignee),
            items: [item],
        });
    }

    return [...groups.values()];
}
