import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { McpKey } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { McpKeysTable } from './mcp-keys-table';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const Now = Date.parse('2026-10-15T12:00:00Z');

function key(overrides: Partial<McpKey> = {}): McpKey {
    return {
        id: 'key-1',
        name: 'Claude Desktop',
        owner: { id: 'user-1', name: 'Malik', avatarUrl: '' },
        fingerprint: 'skrum_…9f2a',
        scopes: ['mcp:read', 'mcp:write'],
        team: 'Atlas',
        createdAt: '2026-09-12T09:00:00Z',
        lastUsedAt: '2026-10-15T11:52:00Z',
        expiresAt: '2026-12-31T00:00:00Z',
        ...overrides,
    };
}

function table() {
    return within(
        document.querySelector('[data-slot="mcp-keys-table"]') as HTMLElement,
    );
}

function cards() {
    return within(
        document.querySelector('[data-slot="mcp-keys-cards"]') as HTMLElement,
    );
}

describe('McpKeysTable', () => {
    it('renders the name, fingerprint, scopes, team and dates of a key', () => {
        renderWithProviders(
            <McpKeysTable keys={[key()]} now={Now} onRevoke={vi.fn()} />,
        );

        const row = table();

        expect(row.getByText('Claude Desktop')).toBeTruthy();
        expect(row.getByText('skrum_…9f2a')).toBeTruthy();
        expect(row.getByText('mcp:read').tagName).toBe('CODE');
        expect(row.getByText('mcp:write')).toBeTruthy();
        expect(row.getByText('Atlas')).toBeTruthy();
        expect(row.getByText('Sep 12, 2026 · Malik')).toBeTruthy();
        expect(row.getByText('8 minutes ago')).toBeTruthy();
        expect(row.getByText('Dec 31, 2026')).toBeTruthy();
    });

    it('says never for a key not used yet and without expiry, and all teams without a team', () => {
        renderWithProviders(
            <McpKeysTable
                keys={[key({ lastUsedAt: null, expiresAt: null, team: null })]}
                now={Now}
                onRevoke={vi.fn()}
            />,
        );

        expect(table().getAllByText('Never')).toHaveLength(2);
        expect(table().getByText('All teams')).toBeTruthy();
    });

    it('asks to revoke the key of its row, from the table and from the cards', () => {
        const onRevoke = vi.fn();
        const other = key({ id: 'key-2', name: 'CI report' });

        renderWithProviders(
            <McpKeysTable
                keys={[key(), other]}
                now={Now}
                onRevoke={onRevoke}
            />,
        );

        fireEvent.click(
            table().getByRole('button', { name: 'Revoke CI report' }),
        );
        fireEvent.click(
            cards().getByRole('button', { name: 'Revoke Claude Desktop' }),
        );

        expect(onRevoke).toHaveBeenNthCalledWith(1, other);
        expect(onRevoke).toHaveBeenNthCalledWith(2, key());
    });

    it('stacks the same fields in cards for narrow screens', () => {
        renderWithProviders(
            <McpKeysTable keys={[key()]} now={Now} onRevoke={vi.fn()} />,
        );

        const card = cards();

        expect(card.getByText('Claude Desktop')).toBeTruthy();
        expect(card.getByText('skrum_…9f2a')).toBeTruthy();
        expect(card.getByText('mcp:read')).toBeTruthy();
        expect(card.getByText('Sep 12, 2026 · Malik')).toBeTruthy();
        expect(card.getByText('8 minutes ago')).toBeTruthy();
    });
});
