import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { McpKey, McpKeysPageProps } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import AdminMcpKeys from './mcp-keys';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Head: () => null,
}));

vi.mock('@/components/admin/admin-shell', () => ({
    AdminShell: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

function key(overrides: Partial<McpKey> = {}): McpKey {
    return {
        id: 'key-1',
        name: 'Claude Desktop',
        owner: { id: 'user-1', name: 'Malik', avatarUrl: '' },
        fingerprint: 'skrum_…9f2a',
        scopes: ['mcp:read'],
        team: null,
        createdAt: '2026-09-12T09:00:00Z',
        lastUsedAt: null,
        expiresAt: null,
        ...overrides,
    };
}

function props(overrides: Partial<McpKeysPageProps> = {}): McpKeysPageProps {
    return {
        keys: { data: [key()], current_page: 1, last_page: 1, total: 1 },
        mcpEnabled: true,
        createUrl: '/settings/api-tokens',
        ...overrides,
    };
}

describe('AdminMcpKeys', () => {
    it('explains the keys and links to the own token settings of the admin to create one', () => {
        renderWithProviders(<AdminMcpKeys {...props()} />);

        expect(
            screen.getByText(
                "To connect AI agents (Claude, IDE, scripts) to the instance's MCP server. A key is shown only once.",
            ),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Create a key' })
                .getAttribute('href'),
        ).toBe('/settings/api-tokens');
    });

    it('opens the revoke dialog for the key of the row', () => {
        renderWithProviders(<AdminMcpKeys {...props()} />);

        fireEvent.click(
            within(
                document.querySelector(
                    '[data-slot="mcp-keys-table"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'Revoke Claude Desktop' }),
        );

        expect(
            within(screen.getByRole('alertdialog')).getByText(
                'Revoke Claude Desktop of Malik?',
            ),
        ).toBeTruthy();
    });

    it('shows an empty state without keys', () => {
        renderWithProviders(
            <AdminMcpKeys
                {...props({
                    keys: { data: [], current_page: 1, last_page: 1, total: 0 },
                })}
            />,
        );

        expect(screen.getByText('No key yet')).toBeTruthy();
        expect(
            document.querySelector('[data-slot="mcp-keys-table"]'),
        ).toBeNull();
    });

    it('warns that the MCP server is off and still lists the keys', () => {
        renderWithProviders(<AdminMcpKeys {...props({ mcpEnabled: false })} />);

        expect(
            screen.getByText('The MCP server is off (SKRUM_MCP_ENABLED).'),
        ).toBeTruthy();
        expect(screen.getAllByText('Claude Desktop').length).toBeGreaterThan(0);
    });

    it('shows no warning while the MCP server is on', () => {
        renderWithProviders(<AdminMcpKeys {...props()} />);

        expect(
            screen.queryByText('The MCP server is off (SKRUM_MCP_ENABLED).'),
        ).toBeNull();
    });

    it('links each page of the keys', () => {
        renderWithProviders(
            <AdminMcpKeys
                {...props({
                    keys: {
                        data: [key()],
                        current_page: 2,
                        last_page: 3,
                        total: 60,
                    },
                })}
            />,
        );

        const pagination = within(
            screen.getByRole('navigation', { name: 'Pagination' }),
        );

        expect(
            pagination
                .getByRole('link', { name: 'Go to page 3' })
                .getAttribute('href'),
        ).toBe('/admin/mcp-keys?page=3');
        expect(
            pagination
                .getByRole('link', { name: 'Go to page 2' })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('hides the pagination on a single page', () => {
        renderWithProviders(<AdminMcpKeys {...props()} />);

        expect(
            screen.queryByRole('navigation', { name: 'Pagination' }),
        ).toBeNull();
    });
});
