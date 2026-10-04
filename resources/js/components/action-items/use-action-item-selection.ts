import { useCallback, useState } from 'react';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import { matchingTarget } from '@/lib/action-items/bulk';
import type { BulkTarget } from '@/lib/action-items/bulk';
import { canCompleteActionItem } from '@/lib/action-items/permissions';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import {
    headState,
    keepListed,
    leaveMatching,
    matchingOffer,
    setSelected,
    toggleSelected,
} from '@/lib/action-items/selection';
import type { ActionItem } from '@/lib/retro/types';

type Options = {
    rows: ActionItem[];
    viewer: ActionItemViewer;
    /** Every item the filters match, on every page. */
    total: number;
    /** Changes with the filters: the selection and "all matching" are cleared. */
    filtersKey: string;
    /** Changes with the page or the grouping: the rows are cleared, "all matching" stays. */
    pageKey: string;
};

export type ActionItemSelection = {
    selected: ReadonlySet<string>;
    /** "All matching" mode: every item the filters match, counted by the page. */
    matching: { count: number } | null;
    /** The rows or the matching items the next bulk request names. */
    count: number;
    /** Every item the filters match, on every page. */
    total: number;
    selectable: (item: ActionItem) => boolean;
    isSelected: (id: string) => boolean;
    toggle: (id: string) => void;
    setMany: (ids: string[], on: boolean) => void;
    selectMatching: () => void;
    clear: () => void;
    head: (ids: string[]) => boolean | 'indeterminate';
    offer: 'offer' | 'too-many' | null;
    target: (filters: ActionItemFilters) => BulkTarget;
};

/** The rows the viewer selected on the table, or every matching item (spec 24 §9.3). */
export function useActionItemSelection({
    rows,
    viewer,
    total,
    filtersKey,
    pageKey,
}: Options): ActionItemSelection {
    const [selected, setSelectedIds] = useState<ReadonlySet<string>>(
        () => new Set(),
    );
    const [matchingOn, setMatchingOn] = useState(false);
    const [known, setKnown] = useState({ rows, filtersKey, pageKey });

    if (known.filtersKey !== filtersKey) {
        setKnown({ rows, filtersKey, pageKey });
        setSelectedIds(new Set());
        setMatchingOn(false);
    } else if (known.pageKey !== pageKey) {
        setKnown({ rows, filtersKey, pageKey });
        setSelectedIds(new Set());
    } else if (known.rows !== rows) {
        setKnown({ rows, filtersKey, pageKey });
        setSelectedIds((current) =>
            keepListed(
                current,
                rows.map((row) => row.id),
            ),
        );
    }

    const selectable = (item: ActionItem): boolean =>
        canCompleteActionItem(item, viewer);

    const selectableIds = rows.filter(selectable).map((row) => row.id);

    const isSelected = (id: string): boolean =>
        matchingOn ? selectableIds.includes(id) : selected.has(id);

    const toggle = (id: string): void => {
        if (matchingOn) {
            setMatchingOn(false);
            setSelectedIds(leaveMatching(selectableIds, id));

            return;
        }

        setSelectedIds((current) => toggleSelected(current, id));
    };

    const setMany = (ids: string[], on: boolean): void => {
        if (matchingOn && !on) {
            setMatchingOn(false);
            setSelectedIds(
                new Set(selectableIds.filter((id) => !ids.includes(id))),
            );

            return;
        }

        if (matchingOn) {
            return;
        }

        setSelectedIds((current) => setSelected(current, ids, on));
    };

    const selectMatching = (): void => {
        setSelectedIds(new Set(selectableIds));
        setMatchingOn(true);
    };

    const clear = useCallback((): void => {
        setSelectedIds(new Set());
        setMatchingOn(false);
    }, []);

    const head = (ids: string[]): boolean | 'indeterminate' => {
        if (matchingOn && ids.length > 0) {
            return true;
        }

        return headState(selected, ids);
    };

    return {
        selected,
        matching: matchingOn ? { count: total } : null,
        count: matchingOn ? total : selected.size,
        total,
        selectable,
        isSelected,
        toggle,
        setMany,
        selectMatching,
        clear,
        head,
        offer: matchingOn
            ? null
            : matchingOffer(selected, selectableIds, rows.length, total),
        target: (filters) =>
            matchingOn
                ? matchingTarget(filters, total)
                : { ids: [...selected] },
    };
}
