/**
 * WCAG 2.1.4: a shortcut made of one character key must be possible to turn
 * off. The switch lives here, outside React, so that the key handler reads
 * it at the moment a key is pressed. It is only written from an effect
 * (use-single-key-shortcuts), never during render.
 */
let enabled = true;

const namedKeys = new Set([
    'enter',
    'escape',
    'esc',
    'delete',
    'backspace',
    'tab',
    'space',
    'home',
    'end',
    'pageup',
    'pagedown',
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
]);

export function setSingleKeyShortcuts(value: boolean): void {
    enabled = value;
}

export function singleKeyShortcutsEnabled(): boolean {
    return enabled;
}

export function parseCombo(combo: string): {
    key: string;
    modifiers: Set<string>;
} {
    const trailingPlus = combo.endsWith('+');
    const parts = (trailingPlus ? combo.slice(0, -1) : combo)
        .split('+')
        .filter((part) => part !== '')
        .map((part) => part.toLowerCase());
    const key = trailingPlus ? '+' : (parts.pop() ?? '');

    return { key, modifiers: new Set(parts) };
}

/**
 * A combo whose only key prints a character and that has no mod and no alt.
 * Shift alone still prints a character: shift+r is one.
 */
export function isCharacterKeyCombo(combo: string): boolean {
    const { key, modifiers } = parseCombo(combo);

    if (modifiers.has('mod') || modifiers.has('alt')) {
        return false;
    }

    return !namedKeys.has(key);
}
