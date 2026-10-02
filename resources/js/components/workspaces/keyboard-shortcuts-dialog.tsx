import { KeyboardShortcuts } from '@/components/skrum/keyboard-shortcuts';
import type { GlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useTrans } from '@/hooks/use-trans';
import { openCommandMenuEvent } from '@/lib/shortcuts/events';
import { shortcutSections } from '@/lib/shortcuts/sections';
import type { ShortcutSurface } from '@/lib/shortcuts/sections';

/**
 * The shortcuts dialog of a layout, fed by its `useGlobalShortcuts()`. The
 * layout says which controls it has, so that the list shows no key that does
 * nothing on this screen.
 */
export function KeyboardShortcutsDialog({
    shortcuts,
    palette = true,
    sidebar = true,
}: ShortcutSurface & { shortcuts: GlobalShortcuts }) {
    const { t } = useTrans();

    return (
        <KeyboardShortcuts
            open={shortcuts.open}
            onOpenChange={shortcuts.setOpen}
            sections={shortcutSections(t, { palette, sidebar })}
            context={shortcuts.context}
            onOpenCommandPalette={
                palette
                    ? () => {
                          shortcuts.setOpen(false);
                          window.dispatchEvent(new Event(openCommandMenuEvent));
                      }
                    : undefined
            }
        />
    );
}
