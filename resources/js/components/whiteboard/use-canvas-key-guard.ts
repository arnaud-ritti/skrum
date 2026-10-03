import { useEffect } from 'react';
import type { RefObject } from 'react';
import { isEditableTarget } from '@/hooks/use-shortcut';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';

/**
 * One printable character, without Ctrl, Meta or Alt (shift alone still
 * prints one), as `isCharacterKeyCombo` reads a combo. Space is a named key.
 */
function isCharacterKey(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return false;
    }

    if (event.key === ' ') {
        return false;
    }

    return Array.from(event.key).length === 1;
}

/**
 * WCAG 2.1.4 on the canvas: with the single-key shortcuts turned off, a
 * character key pressed in the canvas wrapper stops there, in the capture
 * phase, so neither the library's handler (reached in the bubble phase at the
 * React root) nor the board's own keys see it. Typing in a field or in the
 * canvas text editor goes through, and the key's default is never prevented.
 */
export function useCanvasKeyGuard(canvas: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        const wrapper = canvas.current;

        if (wrapper === null) {
            return;
        }

        const guard = (event: KeyboardEvent): void => {
            if (singleKeyShortcutsEnabled()) {
                return;
            }

            if (!isCharacterKey(event)) {
                return;
            }

            if (isEditableTarget(event.target)) {
                return;
            }

            event.stopPropagation();
        };

        wrapper.addEventListener('keydown', guard, true);

        return () => wrapper.removeEventListener('keydown', guard, true);
    }, [canvas]);
}
