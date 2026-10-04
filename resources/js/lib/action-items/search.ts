import { useEffect, useEffectEvent } from 'react';

/**
 * The topbar is drawn by the layout, outside the page that owns the filters:
 * its field hands the term over through a window event, as the palette and the
 * shortcuts dialog are opened (`lib/shortcuts/events`).
 */
export const actionItemsSearchEvent = 'skrum:action-items-search';

export function requestActionItemsSearch(term: string | null): void {
    window.dispatchEvent(
        new CustomEvent<string | null>(actionItemsSearchEvent, {
            detail: term,
        }),
    );
}

export function useActionItemsSearchRequests(
    onSearch: (term: string | null) => void,
): void {
    const handle = useEffectEvent((term: string | null) => onSearch(term));

    useEffect(() => {
        const listener = (event: Event) =>
            handle((event as CustomEvent<string | null>).detail);

        window.addEventListener(actionItemsSearchEvent, listener);

        return () =>
            window.removeEventListener(actionItemsSearchEvent, listener);
    }, []);
}
