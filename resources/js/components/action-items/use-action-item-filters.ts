import { router } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import {
    DefaultGrouping,
    isActionItemGrouping,
} from '@/lib/action-items/grouping';
import type { ActionItemGrouping } from '@/lib/action-items/grouping';
import type { ActionItemPriority } from '@/lib/retro/types';

export type StatusToken = 'todo' | 'doing' | 'completed';

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

export type SourceFilter = 'retro' | 'outside';

export type ActionItemFilters = {
    status: StatusToken[];
    priority: ActionItemPriority[];
    due: DueBucket | null;
    source: SourceFilter | null;
    assignee: string | null;
    team: string | null;
    item: string | null;
    /** The topbar search: text or ticket key (P24-07). */
    q?: string | null;
};

const StatusOrder: StatusToken[] = ['todo', 'doing', 'completed'];

const PriorityOrder: ActionItemPriority[] = ['high', 'medium', 'low'];

/** What is left to do: the statuses the page opens on. */
export const DefaultStatuses: StatusToken[] = ['todo', 'doing'];

export function isDefaultStatus(statuses: StatusToken[]): boolean {
    const given = new Set(statuses);

    return (
        given.size === DefaultStatuses.length &&
        DefaultStatuses.every((status) => given.has(status))
    );
}

function inOrder<T extends string>(values: T[], order: T[]): T[] {
    return order.filter((value) => values.includes(value));
}

export type ActionItemFilterChanges = Partial<Omit<ActionItemFilters, 'item'>>;

/** The stored entry: the query of the page, and "group" beside it. */
type StoredEntry = Record<string, string>;

const GroupKey = 'group';

export function filterStorageKey(workspaceId: string): string {
    return `skrum.actionItemFilters.${workspaceId}`;
}

export function filterQuery(
    filters: Omit<ActionItemFilters, 'item'>,
): Record<string, string> {
    const query: Record<string, string> = {};

    if (!isDefaultStatus(filters.status)) {
        query.status = inOrder(filters.status, StatusOrder).join(',');
    }

    if (filters.priority.length > 0) {
        query.priority = inOrder(filters.priority, PriorityOrder).join(',');
    }

    if (filters.due) {
        query.due = filters.due;
    }

    if (filters.source) {
        query.source = filters.source;
    }

    if (filters.assignee) {
        query.assignee = filters.assignee;
    }

    if (filters.team) {
        query.team = filters.team;
    }

    if (filters.q) {
        query.q = filters.q;
    }

    return query;
}

export function readStoredFilters(workspaceId: string): StoredEntry | null {
    try {
        const stored: unknown = JSON.parse(
            window.localStorage.getItem(filterStorageKey(workspaceId)) ??
                'null',
        );

        if (stored === null || typeof stored !== 'object') {
            return null;
        }

        return Object.fromEntries(
            Object.entries(stored).filter(
                (entry): entry is [string, string] =>
                    typeof entry[1] === 'string',
            ),
        );
    } catch {
        return null;
    }
}

function storeFilters(workspaceId: string, entry: StoredEntry): void {
    try {
        window.localStorage.setItem(
            filterStorageKey(workspaceId),
            JSON.stringify(entry),
        );
    } catch {
        // Storage can be full or disabled; the filters still apply to this visit.
    }
}

export function storedGrouping(entry: StoredEntry | null): ActionItemGrouping {
    const value = entry?.[GroupKey];

    return isActionItemGrouping(value) ? value : DefaultGrouping;
}

function withoutGrouping(entry: StoredEntry): StoredEntry {
    return Object.fromEntries(
        Object.entries(entry).filter(([key]) => key !== GroupKey),
    );
}

function withGrouping(
    query: StoredEntry,
    grouping: ActionItemGrouping,
): StoredEntry {
    return grouping === DefaultGrouping
        ? query
        : { ...query, [GroupKey]: grouping };
}

function forgetFilters(workspaceId: string): void {
    try {
        window.localStorage.removeItem(filterStorageKey(workspaceId));
    } catch {
        // Nothing was stored where storage is disabled.
    }
}

/**
 * The team of the stored entry: there only once the viewer picked a team.
 * Every team is never stored, it lasts one visit and the next one follows
 * the current team again.
 */
const TeamKey = 'team';

function withTeamChoice(
    query: StoredEntry,
    team: string | undefined,
): StoredEntry {
    const entry = Object.fromEntries(
        Object.entries(query).filter(([key]) => key !== TeamKey),
    );

    return team ? { ...entry, [TeamKey]: team } : entry;
}

/** The team the page opens on: the current one, when the viewer sees it. */
function openingTeam(
    currentTeamId: string | null,
    teamIds: string[],
): string | null {
    return currentTeamId !== null && teamIds.includes(currentTeamId)
        ? currentTeamId
        : null;
}

/**
 * Where a visit without a query lands: on the filters the viewer left, and
 * on the current team while they chose no team. `null` keeps the page as it
 * is.
 */
export function landingQuery(
    stored: StoredEntry | null,
    currentTeamId: string | null,
    teamIds: string[],
): Record<string, string> | null {
    const left = stored === null ? {} : withoutGrouping(stored);
    const query = withTeamChoice(
        left,
        left[TeamKey] || (openingTeam(currentTeamId, teamIds) ?? undefined),
    );

    return Object.keys(query).length === 0 ? null : query;
}

/** The facets that narrow the list; the default status is not one. */
export function activeFilterCount(filters: ActionItemFilters): number {
    return [
        filters.team !== null,
        filters.assignee !== null,
        !isDefaultStatus(filters.status),
        filters.priority.length > 0,
        filters.due !== null,
        filters.source !== null,
        Boolean(filters.q),
    ].filter(Boolean).length;
}

type Options = {
    workspace: { id: string; slug: string };
    filters: ActionItemFilters;
    currentTeamId: string | null;
    teamIds: string[];
};

export function useActionItemFilters({
    workspace,
    filters,
    currentTeamId,
    teamIds,
}: Options) {
    const [grouping, setGroupingState] = useState<ActionItemGrouping>(() =>
        storedGrouping(readStoredFilters(workspace.id)),
    );
    const [loading, setLoading] = useState(false);
    const teamKey = teamIds.join(',');

    useEffect(() => {
        if (window.location.search !== '') {
            return;
        }

        const query = landingQuery(
            readStoredFilters(workspace.id),
            currentTeamId,
            teamKey === '' ? [] : teamKey.split(','),
        );

        if (query === null) {
            return;
        }

        router.get(
            WorkspaceActionItemsController.index.url(workspace.slug, { query }),
            {},
            {
                preserveState: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    }, [workspace.id, workspace.slug, currentTeamId, teamKey]);

    const visit = useCallback(
        (query: Record<string, string>) => {
            router.get(
                WorkspaceActionItemsController.index.url(workspace.slug, {
                    query,
                }),
                {},
                {
                    preserveState: true,
                    preserveScroll: true,
                    onStart: () => setLoading(true),
                    onFinish: () => setLoading(false),
                },
            );
        },
        [workspace.slug],
    );

    /**
     * What is stored: the filters, the grouping, and the team only when the
     * viewer chose it. The team of the landing is not a choice.
     */
    const store = (
        query: Record<string, string>,
        team: string | undefined,
        nextGrouping: ActionItemGrouping,
    ): void => {
        storeFilters(
            workspace.id,
            withGrouping(withTeamChoice(query, team), nextGrouping),
        );
    };

    const chosenTeam = (): string | undefined =>
        readStoredFilters(workspace.id)?.[TeamKey] || undefined;

    const apply = (changes: ActionItemFilterChanges): void => {
        const query = filterQuery({ ...filters, ...changes });

        store(
            query,
            changes.team === undefined
                ? chosenTeam()
                : (changes.team ?? undefined),
            grouping,
        );
        visit(query);
    };

    const landingTeam = openingTeam(
        currentTeamId,
        teamKey === '' ? [] : teamKey.split(','),
    );

    /**
     * Back to how the page opens: the current team, the open items and the
     * grouping by sprint. Nothing stays stored, so the next visits open the same way.
     */
    const reset = (): void => {
        setGroupingState(DefaultGrouping);
        forgetFilters(workspace.id);
        visit(landingTeam === null ? {} : { team: landingTeam });
    };

    const setGrouping = (next: ActionItemGrouping): void => {
        setGroupingState(next);
        store(filterQuery(filters), chosenTeam(), next);
    };

    return {
        apply,
        reset,
        grouping,
        setGrouping,
        loading,
        isDefault:
            filters.team === landingTeam &&
            filters.assignee === null &&
            isDefaultStatus(filters.status) &&
            filters.priority.length === 0 &&
            filters.due === null &&
            filters.source === null &&
            !filters.q &&
            grouping === DefaultGrouping,
        activeCount: activeFilterCount(filters),
    };
}
