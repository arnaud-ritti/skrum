import { useEffect, useRef } from 'react';
import {
    isEditableTarget,
    matchesShortcut,
    overlaysOfEvent,
} from '@/hooks/use-shortcut';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';

/** How long the second key of a sequence may wait for after the first. */
export const SequenceWindowMs = 1000;

/**
 * Two keys pressed one after the other (`G` then `A`). The first key is left
 * to whoever else listens to it: only the second one is consumed. Nothing is
 * heard from a field being edited or while a dialog or a menu is open.
 */
export function useShortcutSequence(
    keys: readonly [string, string],
    handler: () => void,
    { enabled = true }: { enabled?: boolean } = {},
): void {
    const handlerRef = useRef(handler);
    const [first, second] = keys;

    useEffect(() => {
        handlerRef.current = handler;
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let armedAt: number | null = null;

        const onKeyDown = (event: KeyboardEvent): void => {
            if (
                event.isComposing ||
                event.repeat ||
                isEditableTarget(event.target) ||
                overlaysOfEvent(event).length > 0 ||
                !singleKeyShortcutsEnabled()
            ) {
                armedAt = null;

                return;
            }

            const isArmed =
                armedAt !== null && Date.now() - armedAt <= SequenceWindowMs;

            if (isArmed && matchesShortcut(event, second)) {
                armedAt = null;

                if (event.defaultPrevented) {
                    return;
                }

                event.preventDefault();
                handlerRef.current();

                return;
            }

            armedAt = matchesShortcut(event, first) ? Date.now() : null;
        };

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [enabled, first, second]);
}
