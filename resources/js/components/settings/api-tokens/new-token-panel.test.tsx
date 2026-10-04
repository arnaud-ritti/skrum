import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { describedBy } from './fixtures';
import { NewTokenPanel } from './new-token-panel';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

const token = { name: 'Claude Code', plainText: '42|skrum_secretvalue' };
const url = 'https://skrum.test/mcp';
const writeText = vi.fn();

beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
});

function panel(onDone = vi.fn()) {
    renderWithProviders(
        <NewTokenPanel token={token} mcpUrl={url} onDone={onDone} />,
    );

    return onDone;
}

describe('NewTokenPanel', () => {
    it('shows the token once, in a read-only field that takes the focus', () => {
        panel();

        const field = screen.getByRole('textbox', { name: 'API token' });

        expect((field as HTMLInputElement).value).toBe(token.plainText);
        expect(field.hasAttribute('readonly')).toBe(true);
        expect(document.activeElement).toBe(field);
        expect(describedBy(field)).toBe(
            "Copy your token now. You won't be able to see it again.",
        );
        expect(screen.getByRole('status').textContent).toContain(
            "Copy your token now. You won't be able to see it again.",
        );
    });

    it('copies the token and says so on the button', async () => {
        panel();

        await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

        expect(writeText).toHaveBeenCalledWith(token.plainText);
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy(),
        );
    });

    it('gives the configuration of Claude Code, then of the other clients', async () => {
        panel();

        expect(
            screen.getByRole('tablist', { name: 'Client configuration' }),
        ).toBeTruthy();
        expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
        expect(screen.getByRole('tabpanel').textContent).toContain(
            `claude mcp add --transport http skrum ${url} --header "Authorization: Bearer ${token.plainText}"`,
        );

        await userEvent.click(
            screen.getByRole('tab', { name: 'Other clients (JSON)' }),
        );

        expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
        expect(screen.getByRole('tabpanel').textContent).toContain(
            '"mcpServers"',
        );
        expect(screen.getByRole('tabpanel').textContent).toContain(
            `Bearer ${token.plainText}`,
        );
    });

    it('copies the configuration that is shown', async () => {
        panel();

        await userEvent.click(
            screen.getByRole('tab', { name: 'Other clients (JSON)' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Copy configuration' }),
        );

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(JSON.parse(writeText.mock.calls[0][0] as string)).toEqual({
            mcpServers: {
                skrum: {
                    type: 'http',
                    url,
                    headers: { Authorization: `Bearer ${token.plainText}` },
                },
            },
        });
    });

    it('points each tab at a panel that exists', () => {
        panel();

        for (const tab of screen.getAllByRole('tab', { hidden: true })) {
            expect(
                document.getElementById(
                    tab.getAttribute('aria-controls') ?? '',
                ),
            ).not.toBeNull();
        }
    });

    it('is dismissed by "Done"', async () => {
        const onDone = panel();

        await userEvent.click(screen.getByRole('button', { name: 'Done' }));

        expect(onDone).toHaveBeenCalledOnce();
    });

    it('lets the keyboard reach and scroll the client configuration', () => {
        panel();

        const snippet = screen.getByRole('region', {
            name: 'Client configuration',
        });

        expect(snippet.tagName).toBe('PRE');
        expect(snippet.tabIndex).toBe(0);
    });
});
