/**
 * Pages of the new front end render their own layout (AppLayout, a shell, or
 * none). A screen commit of plan 18e adds its page here; Task F1 removes the
 * list once every page is on it.
 */
export const ownLayoutPages: readonly string[] = [
    'welcome',
    'about',
    'admin/branding',
    'admin/admins',
    'retros/show',
    'poker/show',
    'games/show',
    'whiteboards/show',
];

const ownLayoutPrefixes: readonly string[] = ['dev/'];

export function usesOwnLayout(name: string): boolean {
    return (
        ownLayoutPages.includes(name) ||
        ownLayoutPrefixes.some((prefix) => name.startsWith(prefix))
    );
}
