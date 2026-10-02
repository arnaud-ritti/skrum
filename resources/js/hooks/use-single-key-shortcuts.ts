import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import ShortcutPreferencesController from '@/actions/App/Http/Controllers/Settings/ShortcutPreferencesController';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';

export const SingleKeyShortcutsStorageKey = 'skrum.single-key-shortcuts';

type PageUser = { single_key_shortcuts?: boolean } | null | undefined;

/**
 * A member's preference is stored on the account; a guest of a session has
 * no account and keeps it in this browser.
 */
export function useSingleKeyShortcuts(): [boolean, (enabled: boolean) => void] {
    const user = (usePage().props.auth as { user?: PageUser } | undefined)
        ?.user;
    const [local, setLocal] = useLocalPreference(
        SingleKeyShortcutsStorageKey,
        true,
    );
    const isMember = user !== null && user !== undefined;
    const enabled = isMember ? user.single_key_shortcuts !== false : local;

    useEffect(() => {
        setSingleKeyShortcuts(enabled);
    }, [enabled]);

    const update = (next: boolean): void => {
        if (!isMember) {
            setLocal(next);

            return;
        }

        router.patch(
            ShortcutPreferencesController.update.url(),
            { single_key_shortcuts: next },
            { preserveScroll: true, preserveState: true },
        );
    };

    return [enabled, update];
}
