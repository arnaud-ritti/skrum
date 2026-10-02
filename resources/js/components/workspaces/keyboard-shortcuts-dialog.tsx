import { Link } from '@inertiajs/react';
import { useId } from 'react';
import { KeyboardShortcuts } from '@/components/skrum/keyboard-shortcuts';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { GlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useTrans } from '@/hooks/use-trans';
import { edit as editAppearance } from '@/routes/appearance';
import { openCommandMenuEvent } from '@/lib/shortcuts/events';
import { shortcutSections } from '@/lib/shortcuts/sections';
import type { ShortcutSurface } from '@/lib/shortcuts/sections';

/**
 * The single-key switch inside the dialog: a guest of a session has no
 * settings page, and must be able to turn these shortcuts off (WCAG 2.1.4).
 */
function SingleKeySwitch({ shortcuts }: { shortcuts: GlobalShortcuts }) {
    const { t } = useTrans();
    const id = useId();

    return (
        <>
            <Label htmlFor={id} className="min-w-0 truncate text-xs">
                {t('Single-key shortcuts')}
            </Label>
            <Switch
                id={id}
                data-slot="single-key-switch"
                checked={shortcuts.singleKey}
                onCheckedChange={shortcuts.setSingleKey}
            />
        </>
    );
}

/**
 * The shortcuts dialog of a layout, fed by its `useGlobalShortcuts()`. The
 * layout says which controls it has, so that the list shows no key that does
 * nothing on this screen, and where the single-key preference is changed:
 * in the dialog itself on a session, on the Appearance page elsewhere.
 */
export function KeyboardShortcutsDialog({
    shortcuts,
    palette = true,
    sidebar = true,
    deck,
    preference = 'settings',
}: ShortcutSurface & {
    shortcuts: GlobalShortcuts;
    preference?: 'switch' | 'settings';
}) {
    const { t } = useTrans();

    return (
        <KeyboardShortcuts
            open={shortcuts.open}
            onOpenChange={shortcuts.setOpen}
            sections={shortcutSections(t, { palette, sidebar, deck })}
            context={shortcuts.context}
            singleKeyDisabled={!shortcuts.singleKey}
            footerExtra={
                preference === 'switch' ? (
                    <SingleKeySwitch shortcuts={shortcuts} />
                ) : (
                    <Link
                        href={editAppearance()}
                        data-slot="keyboard-settings-link"
                        className="truncate rounded-sm font-medium text-skrum-primary-text underline-offset-4 outline-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        onClick={() => shortcuts.setOpen(false)}
                    >
                        {t('Keyboard settings')}
                    </Link>
                )
            }
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
