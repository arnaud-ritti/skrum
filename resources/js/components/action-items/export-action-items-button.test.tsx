import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportActionItemsButton } from '@/components/action-items/export-action-items-button';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const filters: ActionItemFilters = {
    status: ['todo'],
    priority: ['high', 'low'],
    due: 'week',
    source: 'outside',
    assignee: 'user-1',
    team: 'team-1',
    item: 'item-1',
};

describe('ExportActionItemsButton', () => {
    it('links to the CSV of the filtered list without the open item', () => {
        renderWithProviders(
            <ExportActionItemsButton workspace="acme" filters={filters} />,
        );

        const link = screen.getByRole('link', { name: 'Export' });
        const url = new URL(link.getAttribute('href') ?? '', 'http://x');

        expect(url.pathname).toBe('/w/acme/action-items/export');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            status: 'todo',
            priority: 'high,low',
            due: 'week',
            source: 'outside',
            assignee: 'user-1',
            team: 'team-1',
        });
        expect(link.hasAttribute('download')).toBe(true);
    });

    it('keeps the name Export when its label is hidden on a phone', () => {
        renderWithProviders(
            <ExportActionItemsButton workspace="acme" filters={filters} />,
        );

        const link = screen.getByRole('link', { name: 'Export' });

        expect(link.querySelector('.max-sm\\:sr-only')?.textContent).toBe(
            'Export',
        );
    });
});
