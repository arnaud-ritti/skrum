import { assigneeValue } from '@/lib/action-items/assignees';
import type { ActionItem, ActionItemAssignee } from '@/lib/retro/types';

export type ActionItemGrouping = 'sprint' | 'team' | 'assignee' | 'none';

/** In the order of the control: the mockup starts on "Sprint" and ends on "None". */
export const ActionItemGroupings: ActionItemGrouping[] = [
    'sprint',
    'team',
    'assignee',
    'none',
];

/** The page lands grouped by sprint (P24-03). */
export const DefaultGrouping: ActionItemGrouping = 'sprint';

/** A sprint of the page, as `items.sprints` sends it (spec 24 §6.8). */
export type ActionItemSprint = {
    id: string;
    number: number;
    startsOn: string;
    endsOn: string;
    teamId: string;
    state: 'current' | 'finished';
    itemIds: string[];
};

export type SprintPage = {
    sprints: ActionItemSprint[];
    withoutSprint: string[];
};

export type ActionItemGroup = {
    key: string;
    label: string;
    items: ActionItem[];
    /** Set when grouped by sprint: the sprint, or null for "No sprint". */
    sprint?: ActionItemSprint | null;
};

export type ActionItemGroupLabels = {
    team: (teamId: string) => string;
    assignee: (assignee: ActionItemAssignee | null) => string;
    sprint?: (sprint: ActionItemSprint, withTeam: boolean) => string;
    noSprint?: string;
};

const NoSprints: SprintPage = { sprints: [], withoutSprint: [] };

export function isActionItemGrouping(
    value: unknown,
): value is ActionItemGrouping {
    return ActionItemGroupings.some((grouping) => grouping === value);
}

/**
 * The sprint the server placed the row in; a row it did not send (created live)
 * goes to its team's current sprint until the next reload.
 */
export function sprintOfItem(
    item: ActionItem,
    page: SprintPage,
): ActionItemSprint | null {
    const placed = page.sprints.find((sprint) =>
        sprint.itemIds.includes(item.id),
    );

    if (placed !== undefined) {
        return placed;
    }

    if (page.withoutSprint.includes(item.id)) {
        return null;
    }

    return (
        page.sprints.find(
            (sprint) =>
                sprint.teamId === item.teamId && sprint.state === 'current',
        ) ?? null
    );
}

function groupBySprint(
    items: ActionItem[],
    labels: ActionItemGroupLabels,
    page: SprintPage,
): ActionItemGroup[] {
    const placed = items.map((item) => ({
        item,
        sprint: sprintOfItem(item, page),
    }));

    if (placed.every(({ sprint }) => sprint === null)) {
        return [{ key: 'all', label: '', items }];
    }

    const withTeam = new Set(items.map((item) => item.teamId)).size > 1;
    const groups: ActionItemGroup[] = page.sprints
        .map((sprint) => ({
            key: `sprint-${sprint.id}`,
            label: labels.sprint?.(sprint, withTeam) ?? String(sprint.number),
            sprint,
            items: placed
                .filter((entry) => entry.sprint?.id === sprint.id)
                .map(({ item }) => item),
        }))
        .filter((group) => group.items.length > 0);
    const rest = placed
        .filter(({ sprint }) => sprint === null)
        .map(({ item }) => item);

    if (rest.length === 0) {
        return groups;
    }

    return [
        ...groups,
        {
            key: 'no-sprint',
            label: labels.noSprint ?? '',
            sprint: null,
            items: rest,
        },
    ];
}

/**
 * The rows of the current page under one header per sprint, team or assignee.
 * By team and by assignee, groups come in the order of their first row; by
 * sprint, in the order of the page's sprints (latest first), "No sprint" last.
 * Rows keep the order the server gave; "none" is one group without a label.
 */
export function groupItems(
    items: ActionItem[],
    by: ActionItemGrouping,
    labels: ActionItemGroupLabels,
    page: SprintPage = NoSprints,
): ActionItemGroup[] {
    if (items.length === 0) {
        return [];
    }

    if (by === 'none') {
        return [{ key: 'all', label: '', items }];
    }

    if (by === 'sprint') {
        return groupBySprint(items, labels, page);
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
