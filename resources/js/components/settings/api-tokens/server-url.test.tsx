import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ServerUrl } from './server-url';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

const writeText = vi.fn();

beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
});

describe('ServerUrl', () => {
    it('is the "MCP server" region with the address in a read-only field', () => {
        renderWithProviders(<ServerUrl mcpUrl="https://skrum.test/mcp" />);

        expect(screen.getByRole('region', { name: 'MCP server' })).toBeTruthy();

        const field = screen.getByRole('textbox', { name: 'Server URL' });

        expect(field.getAttribute('id')).toBe('mcp-url');
        expect(field.hasAttribute('readonly')).toBe(true);
        expect((field as HTMLInputElement).value).toBe(
            'https://skrum.test/mcp',
        );
    });

    it('copies the address and says so on the button', async () => {
        renderWithProviders(<ServerUrl mcpUrl="https://skrum.test/mcp" />);

        await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

        expect(writeText).toHaveBeenCalledWith('https://skrum.test/mcp');
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy(),
        );
    });

    it('keeps the three sentences of the old page', () => {
        renderWithProviders(<ServerUrl mcpUrl="https://skrum.test/mcp" />);

        expect(
            screen.getByText(
                'Use a client that can send an Authorization header (Claude Code, Cursor, VS Code…). Web connectors that require a sign-in are not supported yet.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Data you read through this connection is sent to the AI application you use.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Tokens stay valid after a password change. Revoke them here.',
            ),
        ).toBeTruthy();
    });
});
