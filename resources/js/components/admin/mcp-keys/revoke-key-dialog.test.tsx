import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpKey } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { RevokeKeyDialog } from './revoke-key-dialog';

type VisitOptions = {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const router = vi.hoisted(() => ({ delete: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router,
}));

const mcpKey: McpKey = {
    id: '0199a0b4-6d8e-7c41-9f2a-1b2c3d4e5f60',
    name: 'Claude Desktop',
    owner: { id: 'user-1', name: 'Malik', avatarUrl: '' },
    fingerprint: 'skrum_…9f2a',
    scopes: ['mcp:read'],
    team: null,
    createdAt: '2026-09-12T09:00:00Z',
    lastUsedAt: null,
    expiresAt: null,
};

beforeEach(() => {
    router.delete.mockReset();
});

describe('RevokeKeyDialog', () => {
    it('names the key and its owner before revoking', () => {
        renderWithProviders(
            <RevokeKeyDialog mcpKey={mcpKey} open onOpenChange={vi.fn()} />,
        );

        const dialog = within(screen.getByRole('alertdialog'));

        expect(
            dialog.getByText('Revoke Claude Desktop of Malik?'),
        ).toBeTruthy();
        expect(dialog.getByText('Agents using it stop at once.')).toBeTruthy();
        expect(router.delete).not.toHaveBeenCalled();
    });

    it('sends DELETE for the key and closes once the server has answered', async () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <RevokeKeyDialog
                mcpKey={mcpKey}
                open
                onOpenChange={onOpenChange}
            />,
        );

        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Revoke',
            }),
        );

        const [url, options] = router.delete.mock.calls[0] as [
            string,
            VisitOptions,
        ];

        expect(url).toBe(`/admin/mcp-keys/${mcpKey.id}`);

        options.onSuccess?.();
        options.onFinish?.();

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('stays open with a message when the revocation fails', async () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <RevokeKeyDialog
                mcpKey={mcpKey}
                open
                onOpenChange={onOpenChange}
            />,
        );

        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Revoke',
            }),
        );

        const [, options] = router.delete.mock.calls[0] as [
            string,
            VisitOptions,
        ];

        options.onFinish?.();

        expect(
            await screen.findByText('Something went wrong. Please try again.'),
        ).toBeTruthy();
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('shows the refusal of the server', async () => {
        renderWithProviders(
            <RevokeKeyDialog mcpKey={mcpKey} open onOpenChange={vi.fn()} />,
        );

        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Revoke',
            }),
        );

        const [, options] = router.delete.mock.calls[0] as [
            string,
            VisitOptions,
        ];

        options.onError?.({ key: 'This key is already revoked.' });
        options.onFinish?.();

        expect(
            await screen.findByText('This key is already revoked.'),
        ).toBeTruthy();
    });
});
