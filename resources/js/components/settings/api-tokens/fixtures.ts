import type { ApiToken } from '@/types';

export const activeToken: ApiToken = {
    id: '0199a000-0000-7000-8000-0000000000a1',
    name: 'Claude Code',
    hint: 'a1b2',
    scopes: ['mcp:read', 'mcp:write', 'mcp:delete'],
    team: { id: '0199a000-0000-7000-8000-0000000000t1', name: 'Atlas' },
    teamAccessible: true,
    createdAt: '2026-09-01T08:00:00+00:00',
    expiresAt: '2026-11-30T08:00:00+00:00',
    lastUsedAt: '2026-09-28T08:00:00+00:00',
    isExpired: false,
};

export const expiredToken: ApiToken = {
    id: '0199a000-0000-7000-8000-0000000000a2',
    name: 'Old script',
    hint: 'c3d4',
    scopes: ['mcp:read'],
    team: null,
    teamAccessible: true,
    createdAt: '2026-01-10T08:00:00+00:00',
    expiresAt: '2026-02-09T08:00:00+00:00',
    lastUsedAt: null,
    isExpired: true,
};

export const orphanToken: ApiToken = {
    id: '0199a000-0000-7000-8000-0000000000a3',
    name: 'Cursor',
    hint: 'e5f6',
    scopes: ['mcp:read', 'mcp:write'],
    team: { id: '0199a000-0000-7000-8000-0000000000t2', name: 'Borealis' },
    teamAccessible: false,
    createdAt: '2026-06-15T08:00:00+00:00',
    expiresAt: null,
    lastUsedAt: null,
    isExpired: false,
};

/** Text of the elements an element names in `aria-describedby`. */
export function describedBy(element: Element): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
}
