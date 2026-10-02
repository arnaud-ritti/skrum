import { useEffect, useRef } from 'react';

export type UseShortcutOptions = {
    enabled?: boolean;
    enableOnFormTags?: boolean;
    enableInOverlays?: boolean;
    preventDefault?: boolean;
};

const editableSelector =
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]';

const overlaySelector =
    '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"]';

export function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }

    return target.closest(editableSelector) !== null;
}

/**
 * Open dialogs, menus and other overlays a key press belongs to: those in the
 * event path, and the one that holds focus.
 */
export function overlaysOfEvent(event: KeyboardEvent): Element[] {
    const overlays = event
        .composedPath()
        .filter(
            (node): node is Element =>
                node instanceof Element && node.matches(overlaySelector),
        );
    const focused = document.activeElement?.closest(overlaySelector) ?? null;

    if (focused !== null && !overlays.includes(focused)) {
        overlays.push(focused);
    }

    return overlays;
}

function parseCombo(combo: string): { key: string; modifiers: Set<string> } {
    const trailingPlus = combo.endsWith('+');
    const parts = (trailingPlus ? combo.slice(0, -1) : combo)
        .split('+')
        .filter((part) => part !== '')
        .map((part) => part.toLowerCase());
    const key = trailingPlus ? '+' : (parts.pop() ?? '');

    return { key, modifiers: new Set(parts) };
}

function normalizeKey(key: string): string {
    const lower = key.toLowerCase();

    if (lower === 'esc') {
        return 'escape';
    }

    if (lower === ' ' || lower === 'spacebar') {
        return 'space';
    }

    return lower;
}

export function matchesShortcut(event: KeyboardEvent, combo: string): boolean {
    const { key, modifiers } = parseCombo(combo);

    if (normalizeKey(event.key) !== normalizeKey(key)) {
        return false;
    }

    const wantsMod = modifiers.has('mod');
    const hasMod = event.metaKey || event.ctrlKey;

    if (wantsMod !== hasMod) {
        return false;
    }

    if (modifiers.has('alt') !== event.altKey) {
        return false;
    }

    const keyIsLetter = key.toUpperCase() !== key.toLowerCase();
    const keyIsNamed = key.length > 1;

    if (keyIsLetter || keyIsNamed) {
        return modifiers.has('shift') === event.shiftKey;
    }

    return true;
}

export function useShortcut(
    combo: string,
    handler: (event: KeyboardEvent) => void,
    {
        enabled = true,
        enableOnFormTags = false,
        enableInOverlays = false,
        preventDefault = true,
    }: UseShortcutOptions = {},
): void {
    const handlerRef = useRef(handler);

    useEffect(() => {
        handlerRef.current = handler;
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        /**
         * A shortcut belongs to the layer it was registered in: overlays
         * already open when it is enabled (a shortcut of the dialog itself)
         * keep it, overlays opened later silence it. The snapshot waits for a
         * microtask because a portal mounts after its owner's effects.
         */
        let ownOverlays = new Set<Element>();
        let isRegistered = true;

        queueMicrotask(() => {
            if (isRegistered) {
                ownOverlays = new Set(
                    document.querySelectorAll(overlaySelector),
                );
            }
        });

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || event.isComposing) {
                return;
            }

            if (!enableOnFormTags && isEditableTarget(event.target)) {
                return;
            }

            if (!matchesShortcut(event, combo)) {
                return;
            }

            if (
                !enableInOverlays &&
                overlaysOfEvent(event).some(
                    (overlay) => !ownOverlays.has(overlay),
                )
            ) {
                return;
            }

            if (preventDefault) {
                event.preventDefault();
            }

            handlerRef.current(event);
        };

        document.addEventListener('keydown', onKeyDown);

        return () => {
            isRegistered = false;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [combo, enabled, enableOnFormTags, enableInOverlays, preventDefault]);
}
