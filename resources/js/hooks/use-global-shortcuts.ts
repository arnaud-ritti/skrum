import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ShortcutSectionId } from '@/components/skrum/keyboard-shortcuts';
import { useShortcut } from '@/hooks/use-shortcut';
import { useSingleKeyShortcuts } from '@/hooks/use-single-key-shortcuts';
import { openKeyboardShortcutsEvent } from '@/lib/shortcuts/events';
import { contextOfPage } from '@/lib/shortcuts/sections';

/**
 * Where "?" belongs to the element: the whiteboard canvas has its own help.
 * A poker deck that holds the "?" card plays it and prevents the event.
 */
const ownKeyAreas = '.excalidraw';

function isInOwnKeyArea(event: KeyboardEvent): boolean {
    return (
        event.target instanceof Element &&
        event.target.closest(ownKeyAreas) !== null
    );
}

export type GlobalShortcuts = {
    open: boolean;
    setOpen: (open: boolean) => void;
    context: ShortcutSectionId | undefined;
    /** Shortcuts made of one character key answer. */
    singleKey: boolean;
    setSingleKey: (enabled: boolean) => void;
};

/**
 * "?" opens the shortcuts dialog outside fields, the whiteboard canvas, a
 * poker deck with a "?" card and other overlays; mod+/ opens it from a field too, for when
 * "?" is being typed or single-key shortcuts are off. The palette entry and
 * the visible buttons ask for it through a window event.
 */
export function useGlobalShortcuts(): GlobalShortcuts {
    const { component } = usePage();
    const [open, setOpen] = useState(false);
    const [singleKey, setSingleKey] = useSingleKeyShortcuts();

    useEffect(() => {
        const show = () => setOpen(true);

        window.addEventListener(openKeyboardShortcutsEvent, show);

        return () =>
            window.removeEventListener(openKeyboardShortcutsEvent, show);
    }, []);

    useShortcut(
        '?',
        (event) => {
            if (event.repeat || isInOwnKeyArea(event)) {
                return;
            }

            setOpen(true);
        },
        { enabled: !open, preventDefault: false },
    );

    useShortcut('mod+/', () => setOpen(true), {
        enabled: !open,
        enableOnFormTags: true,
    });

    return {
        open,
        setOpen,
        context: contextOfPage(component),
        singleKey,
        setSingleKey,
    };
}
