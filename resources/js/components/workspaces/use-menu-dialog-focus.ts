import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type FindOrigin = () => HTMLElement | null | undefined;

/** The "…" button of a card of the templates page, by the `data-test` of the card. */
export function templateCardMenu(dataTest: string): FindOrigin {
    return () =>
        document.querySelector<HTMLElement>(
            `[data-test="${dataTest}"] [data-slot="template-card-menu"]`,
        );
}

/**
 * The element focused now, as long as it is still in the page at closing
 * time; `null` when nothing holds the focus, and then nothing is moved.
 */
export function focusedElement(): FindOrigin | null {
    const active = document.activeElement;

    if (!(active instanceof HTMLElement) || active === document.body) {
        return null;
    }

    return () => (active.isConnected ? active : null);
}

/**
 * A dialog opened from an entry of a "…" menu has no trigger to give the
 * focus back to: the entry is gone with its menu. `openedFrom` records how to
 * find the control to return to; when the dialog closes the focus goes there,
 * or to the element behind `fallbackRef` when that control left the page.
 */
export function useMenuDialogFocus<Fallback extends HTMLElement = HTMLElement>(
    isOpen: boolean,
): {
    fallbackRef: RefObject<Fallback | null>;
    openedFrom: (find: FindOrigin | null) => void;
    originRemoved: () => void;
} {
    const fallbackRef = useRef<Fallback>(null);
    const origin = useRef<FindOrigin | null>(null);
    const wasOpen = useRef(false);
    const removed = useRef(false);

    useEffect(() => {
        if (isOpen) {
            wasOpen.current = true;

            return;
        }

        if (!wasOpen.current) {
            return;
        }

        const find = origin.current;
        const isRemoved = removed.current;

        wasOpen.current = false;
        origin.current = null;
        removed.current = false;

        if (find === null) {
            return;
        }

        const target = isRemoved ? null : find();

        (target ?? fallbackRef.current)?.focus();
    }, [isOpen]);

    const openedFrom = useCallback((find: FindOrigin | null): void => {
        origin.current = find;
        removed.current = false;
    }, []);

    const originRemoved = useCallback((): void => {
        removed.current = true;
    }, []);

    return { fallbackRef, openedFrom, originRemoved };
}
