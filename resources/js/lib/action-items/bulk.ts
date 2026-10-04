import WorkspaceActionItemBulkDeletionsController from '@/actions/App/Http/Controllers/WorkspaceActionItemBulkDeletionsController';
import WorkspaceActionItemBulkUpdatesController from '@/actions/App/Http/Controllers/WorkspaceActionItemBulkUpdatesController';
import WorkspaceActionItemCsvExportsController from '@/actions/App/Http/Controllers/WorkspaceActionItemCsvExportsController';
import { filterQuery } from '@/components/action-items/use-action-item-filters';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import { retroRequest } from '@/lib/retro/api';
import type {
    ActionItem,
    ActionItemPriority,
    ActionItemStatus,
} from '@/lib/retro/types';

/** Up to 500 items, each in its own transaction, take longer than one change. */
const BulkTimeoutMs = 60_000;

/** Rows of the page by id, or every item matching the filters, counted (spec 24 §6.5). */
export type BulkTarget =
    | { ids: string[] }
    | { filters: Record<string, string>; count: number };

export type BulkChanges = Partial<{
    status: ActionItemStatus;
    priority: ActionItemPriority;
    due_on: string | null;
    assignee_user_id: string | null;
}>;

/** `title` is null for an item that is gone or that the viewer cannot see. */
export type BulkRefusal = { id: string; title: string | null; message: string };

/** `actionItems` is empty for a filters target: the page reloads instead. */
export type BulkUpdateResult = {
    actionItems: ActionItem[];
    changedCount: number;
    refused: BulkRefusal[];
};

export type BulkDeleteResult = { deleted: string[]; refused: BulkRefusal[] };

/**
 * The page's filters as its query writes them and the count it showed;
 * `filterQuery` never writes `item`, and the default filters are `{}`.
 */
export function matchingTarget(
    filters: ActionItemFilters,
    count: number,
): BulkTarget {
    return { filters: filterQuery(filters), count };
}

export function bulkUpdate(
    workspace: string,
    target: BulkTarget,
    changes: BulkChanges,
): Promise<BulkUpdateResult> {
    return retroRequest<BulkUpdateResult>(
        WorkspaceActionItemBulkUpdatesController.store(workspace),
        { ...target, changes },
        { timeoutMs: BulkTimeoutMs },
    );
}

export function bulkDelete(
    workspace: string,
    target: BulkTarget,
): Promise<BulkDeleteResult> {
    return retroRequest<BulkDeleteResult>(
        WorkspaceActionItemBulkDeletionsController.store(workspace),
        { ...target },
        { timeoutMs: BulkTimeoutMs },
    );
}

/** The list as filtered, every page: `item` and `page` are not part of an export. */
export function actionItemsExportUrl(
    workspace: string,
    filters: ActionItemFilters,
): string {
    return WorkspaceActionItemCsvExportsController.show.url(workspace, {
        query: filterQuery(filters),
    });
}
