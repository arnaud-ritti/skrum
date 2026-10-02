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
    'retros/join',
    'retros/session-ended',
    'poker/show',
    'poker/decks',
    'games/index',
    'games/join',
    'poker/estimates',
    'poker/join',
    'games/show',
    'whiteboards/show',
    'whiteboards/join',
    'settings/profile',
    'settings/security',
    'settings/appearance',
    'settings/notifications',
    'settings/api-tokens',
    'teams/integrations',
];

const ownLayoutPrefixes: readonly string[] = ['admin/', 'dev/'];

export function usesOwnLayout(name: string): boolean {
    return (
        ownLayoutPages.includes(name) ||
        ownLayoutPrefixes.some((prefix) => name.startsWith(prefix))
    );
}
