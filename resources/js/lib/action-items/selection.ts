/** The ids of the selected rows; a new set on every change, so React sees it. */
export type Selection = ReadonlySet<string>;

export function toggleSelected(selection: Selection, id: string): Set<string> {
    const next = new Set(selection);

    if (next.has(id)) {
        next.delete(id);

        return next;
    }

    next.add(id);

    return next;
}

export function setSelected(
    selection: Selection,
    ids: string[],
    selected: boolean,
): Set<string> {
    const next = new Set(selection);

    for (const id of ids) {
        if (selected) {
            next.add(id);
        } else {
            next.delete(id);
        }
    }

    return next;
}

/** A row that left the list leaves the selection; nothing changes otherwise. */
export function keepListed<T extends Selection>(
    selection: T,
    listedIds: string[],
): T | Set<string> {
    const listed = new Set(listedIds);

    if ([...selection].every((id) => listed.has(id))) {
        return selection;
    }

    return new Set([...selection].filter((id) => listed.has(id)));
}

/** The header box: none, some (`indeterminate`) or all of the selectable rows. */
export function headState(
    selection: Selection,
    selectableIds: string[],
): boolean | 'indeterminate' {
    const selected = selectableIds.filter((id) => selection.has(id)).length;

    if (selected === 0) {
        return false;
    }

    return selected === selectableIds.length ? true : 'indeterminate';
}

/** Spec 24 §5 rule 7: the server refuses more matching items than this. */
export const MatchingCap = 500;

/**
 * "Select all :count matching" once every selectable row of the page is
 * selected and the list has more items than the page; disabled above the cap.
 */
export function matchingOffer(
    selection: Selection,
    selectableIds: string[],
    total: number,
): 'offer' | 'too-many' | null {
    const wholePage =
        selectableIds.length > 0 &&
        selectableIds.every((id) => selection.has(id));

    if (!wholePage || total <= selectableIds.length) {
        return null;
    }

    return total > MatchingCap ? 'too-many' : 'offer';
}

/** Unticking a row in "all matching" mode keeps the page's other selectable rows. */
export function leaveMatching(
    selectableIds: string[],
    id: string,
): Set<string> {
    return new Set(selectableIds.filter((selectable) => selectable !== id));
}
