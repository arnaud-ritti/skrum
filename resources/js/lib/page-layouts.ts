/**
 * Pages of the new front end render their own layout (AppLayout, a shell, or
 * none). A screen commit of plan 18e adds its page here; Task F1 removes the
 * list once every page is on it.
 */
export const ownLayoutPages: readonly string[] = [
    'about',
    'auth/login',
    'auth/register',
    'auth/forgot-password',
    'auth/reset-password',
    'auth/verify-email',
    'auth/two-factor-challenge',
    'auth/confirm-password',
    'invitations/show',
    'errors/error',
    'teams/show',
    'retros/show',
    'poker/show',
    'poker/decks',
    'games/show',
    'whiteboards/show',
];

const ownLayoutPrefixes: readonly string[] = ['admin/', 'dev/'];

export function usesOwnLayout(name: string): boolean {
    return (
        ownLayoutPages.includes(name) ||
        ownLayoutPrefixes.some((prefix) => name.startsWith(prefix))
    );
}
