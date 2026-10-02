import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
    isCharacterKeyCombo,
    singleKeyShortcutsEnabled,
} from '@/lib/shortcuts/preference';

export type UseShortcutOptions = {
    enabled?: boolean;
    /**
     * Element the shortcut belongs to. Overlays that contain it are its own
     * layer; a key pressed in any other open overlay is ignored, whenever that
     * overlay opened. Without a scope the layer is guessed from the overlays
     * open when the shortcut is enabled, which is only right for a shortcut
     * enabled by its own overlay opening.
     */
    scope?: RefObject<Element | null>;
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

    const keyIsLetter = key.toUpperCase() !== key.toLowerCase();
    const keyIsNamed = key.length > 1;
    const keyIsSign = !keyIsLetter && !keyIsNamed && !/^[0-9]$/.test(key);

    // Browsers on Windows report AltGr as Ctrl and Alt held together: on a
    // layout where a sign is typed with AltGr, they are how it is typed.
    const typedWithAltGraph =
        keyIsSign &&
        event.ctrlKey &&
        event.altKey &&
        !event.metaKey &&
        !modifiers.has('mod') &&
        !modifiers.has('alt');

    if (typedWithAltGraph) {
        return true;
    }

    const wantsMod = modifiers.has('mod');
    const hasMod = event.metaKey || event.ctrlKey;

    if (wantsMod !== hasMod) {
        return false;
    }

    if (modifiers.has('alt') !== event.altKey) {
        return false;
    }

    if (keyIsLetter || keyIsNamed) {
        return modifiers.has('shift') === event.shiftKey;
    }

    return true;
}

export function useShortcut(
    combo: string | string[],
    handler: (event: KeyboardEvent) => void,
    {
        enabled = true,
        scope,
        enableOnFormTags = false,
        enableInOverlays = false,
        preventDefault = true,
    }: UseShortcutOptions = {},
): void {
    const handlerRef = useRef(handler);
    const scopeRef = useRef(scope);
    const comboKey = Array.isArray(combo) ? combo.join(' ') : combo;
    const hasScope = scope !== undefined;

    useEffect(() => {
        handlerRef.current = handler;
        scopeRef.current = scope;
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const combos = comboKey.split(' ');

        /**
         * Without a scope, a shortcut belongs to the layer it was enabled in:
         * overlays already open at that moment (a shortcut of the dialog
         * itself) keep it, overlays opened later silence it. The snapshot
         * waits for a microtask because a portal mounts after its owner's
         * effects.
         */
        let ownOverlays = new Set<Element>();
        let isRegistered = true;

        if (!hasScope) {
            queueMicrotask(() => {
                if (isRegistered) {
                    ownOverlays = new Set(
                        document.querySelectorAll(overlaySelector),
                    );
                }
            });
        }

        const isOwnOverlay = (overlay: Element): boolean => {
            if (!hasScope) {
                return ownOverlays.has(overlay);
            }

            const scopeElement = scopeRef.current?.current ?? null;

            return scopeElement !== null && overlay.contains(scopeElement);
        };

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || event.isComposing) {
                return;
            }

            if (!enableOnFormTags && isEditableTarget(event.target)) {
                return;
            }

            const matched = combos.find((entry) =>
                matchesShortcut(event, entry),
            );

            if (matched === undefined) {
                return;
            }

            if (!singleKeyShortcutsEnabled() && isCharacterKeyCombo(matched)) {
                return;
            }

            if (
                !enableInOverlays &&
                overlaysOfEvent(event).some((overlay) => !isOwnOverlay(overlay))
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
    }, [
        comboKey,
        enabled,
        hasScope,
        enableOnFormTags,
        enableInOverlays,
        preventDefault,
    ]);
}
