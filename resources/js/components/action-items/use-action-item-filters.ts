import { router } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import { isActionItemGrouping } from '@/lib/action-items/grouping';
import type { ActionItemGrouping } from '@/lib/action-items/grouping';

export type StatusFilter = 'open' | 'overdue' | 'completed' | 'all';

export type ActionItemFilters = {
    status: StatusFilter;
    assignee: string | null;
    team: string | null;
    item: string | null;
};

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

    if (filters.status !== 'open') {
        query.status = filters.status;
    }

    if (filters.assignee) {
        query.assignee = filters.assignee;
    }

    if (filters.team) {
        query.team = filters.team;
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

export function storeFilters(workspaceId: string, entry: StoredEntry): void {
    try {
        window.localStorage.setItem(
            filterStorageKey(workspaceId),
            JSON.stringify(entry),
        );
    } catch {
        // Storage can be full or disabled; the filters still apply to this visit.
    }
}

export function clearStoredFilters(workspaceId: string): void {
    try {
        window.localStorage.removeItem(filterStorageKey(workspaceId));
    } catch {
        // Nothing was stored where storage is disabled.
    }
}

export function storedGrouping(entry: StoredEntry | null): ActionItemGrouping {
    const value = entry?.[GroupKey];

    return isActionItemGrouping(value) ? value : 'none';
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
    return grouping === 'none' ? query : { ...query, [GroupKey]: grouping };
}

/**
 * Where a visit without a query lands: on the filters the viewer left, and
 * without any on the current team. `null` keeps the page as it is.
 */
export function landingQuery(
    stored: StoredEntry | null,
    currentTeamId: string | null,
    teamIds: string[],
): Record<string, string> | null {
    if (stored !== null) {
        const query = withoutGrouping(stored);

        return Object.keys(query).length === 0 ? null : query;
    }

    if (currentTeamId === null || !teamIds.includes(currentTeamId)) {
        return null;
    }

    return { team: currentTeamId };
}

/** The facets that narrow the list; the default status is not one. */
export function activeFilterCount(filters: ActionItemFilters): number {
    return [
        filters.team !== null,
        filters.assignee !== null,
        filters.status !== 'open',
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
            { preserveState: true, replace: true },
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

    const apply = (changes: ActionItemFilterChanges): void => {
        const query = filterQuery({ ...filters, ...changes });

        storeFilters(workspace.id, withGrouping(query, grouping));
        visit(query);
    };

    /** Back to every team and the open items; the stored choice is forgotten. */
    const reset = (): void => {
        clearStoredFilters(workspace.id);
        setGroupingState('none');
        visit({});
    };

    const setGrouping = (next: ActionItemGrouping): void => {
        setGroupingState(next);
        storeFilters(workspace.id, withGrouping(filterQuery(filters), next));
    };

    return {
        apply,
        reset,
        grouping,
        setGrouping,
        loading,
        isDefault: activeFilterCount(filters) === 0,
        activeCount: activeFilterCount(filters),
    };
}
