import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { activeToken, expiredToken, orphanToken } from './fixtures';
import { TokensTable } from './tokens-table';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

const formatDate = (value: string | null): string =>
    value === null ? 'Never' : value.slice(0, 10);

function table(newTokenName?: string, onRevoke = vi.fn()) {
    renderWithProviders(
        <TokensTable
            tokens={[activeToken, expiredToken, orphanToken]}
            formatDate={formatDate}
            newTokenName={newTokenName}
            onRevoke={onRevoke}
        />,
    );

    return onRevoke;
}

function cells(name: string): HTMLElement[] {
    const row = screen
        .getAllByRole('row')
        .find((candidate) => candidate.textContent?.includes(name));

    return within(row as HTMLElement).getAllByRole('cell');
}

describe('TokensTable', () => {
    it('keeps its eight columns in the order the walkthrough reads', () => {
        table();

        expect(
            screen
                .getAllByRole('columnheader')
                .map((header) => header.textContent),
        ).toEqual([
            'Name',
            'Scopes',
            'Team',
            'Created',
            'Expires',
            'Last used',
            'Status',
            'Actions',
        ]);
    });

    it('shows a token: name and hint, one badge per scope, team, dates, state', () => {
        table();

        const row = cells('Claude Code');

        expect(row[0].textContent).toContain('Claude Code');
        expect(row[0].textContent).toContain('skrum_…a1b2');
        expect(
            Array.from(row[1].querySelectorAll('[data-slot="badge"]')).map(
                (badge) => badge.textContent,
            ),
        ).toEqual(['Read', 'Create and update', 'Delete my messages']);
        expect(row[2].textContent).toContain('Atlas');
        expect(row[3].textContent).toContain('2026-09-01');
        expect(row[4].textContent).toContain('2026-11-30');
        expect(row[5].textContent).toContain('2026-09-28');
        expect(row[6].textContent).toContain('Active');
    });

    it('says "All teams" and "Never" for a token without team, expiry or use', () => {
        table();

        expect(cells('Old script')[2].textContent).toContain('All teams');
        expect(cells('Old script')[5].textContent).toContain('Never');
        expect(cells('Cursor')[4].textContent).toContain('Never');
    });

    it('marks an expired token on its row and in its state', () => {
        table();

        const row = cells('Old script');

        expect(row[6].textContent).toContain('Expired');
        expect(row[0].closest('tr')?.getAttribute('data-done')).toBe('true');
        expect(
            cells('Claude Code')[0].closest('tr')?.hasAttribute('data-done'),
        ).toBe(false);
    });

    it('warns under the team the member can no longer see', () => {
        table();

        expect(cells('Cursor')[2].textContent).toContain(
            'No access to this team anymore',
        );
        expect(cells('Claude Code')[2].textContent).not.toContain(
            'No access to this team anymore',
        );
    });

    it('marks the token that was just created as new, outside the scopes cell', () => {
        table('Cursor');

        const row = cells('Cursor');

        expect(within(row[0]).getByText('New')).toBeTruthy();
        expect(row[1].querySelectorAll('[data-slot="badge"]')).toHaveLength(2);
        expect(within(cells('Claude Code')[0]).queryByText('New')).toBeNull();
    });

    it('asks to revoke the token of the row, with an icon and a label', async () => {
        const onRevoke = table();

        const revoke = screen.getByRole('button', { name: 'Revoke Cursor' });

        expect(revoke.textContent).toContain('Revoke');
        expect(revoke.querySelector('svg')).not.toBeNull();

        await userEvent.click(revoke);

        expect(onRevoke).toHaveBeenCalledWith(orphanToken);
    });
});
