import { useEffect, useRef } from 'react';

export type UseShortcutOptions = {
    enabled?: boolean;
    enableOnFormTags?: boolean;
    preventDefault?: boolean;
};

const editableSelector =
    'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }

    return target.closest(editableSelector) !== null;
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

            if (preventDefault) {
                event.preventDefault();
            }

            handlerRef.current(event);
        };

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [combo, enabled, enableOnFormTags, preventDefault]);
}
