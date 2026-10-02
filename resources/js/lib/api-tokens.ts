import type { ApiTokenScope } from '@/types';

/** English label of a scope; it is also its translation key. */
export const ScopeLabels: Record<ApiTokenScope, string> = {
    'mcp:read': 'Read',
    'mcp:write': 'Create and update',
    'mcp:delete': 'Delete my messages',
};

export type TokenDateFormatter = (value: string | null) => string;

/** A date of a token in the member's language; `never` when there is none. */
export function tokenDateFormatter(
    locale: string,
    never: string,
): TokenDateFormatter {
    const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

    return (value) => (value === null ? never : format.format(new Date(value)));
}
