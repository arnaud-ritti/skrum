import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionItemsPageProps } from '@/components/action-items/action-items-page';
import { renderWithProviders } from '@/test/render';
import ActionItemsIndex from './index';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Head: () => null,
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({
        actions,
        search,
        children,
    }: {
        actions?: ReactNode;
        search?: ReactNode;
        children: ReactNode;
    }) => (
        <div>
            <header>
                {search}
                {actions}
            </header>
            {children}
        </div>
    ),
}));

vi.mock('@/components/action-items/action-items-page', () => ({
    ActionItemsPage: () => null,
}));

const team = { id: 'team-1', name: 'Platform' };

function pageProps(
    creatableTeams: ActionItemsPageProps['creatableTeams'],
    q: string | null = null,
): ActionItemsPageProps {
    return {
        workspace: { id: 'workspace-1', slug: 'acme', name: 'Acme' },
        filters: {
            status: ['todo', 'doing'],
            priority: [],
            due: 'overdue',
            source: null,
            assignee: null,
            team: null,
            item: null,
            q,
        },
        filterTeams: [],
        creatableTeams,
    } as unknown as ActionItemsPageProps;
}

describe('ActionItemsIndex topbar', () => {
    it('places Export before New action item', () => {
        renderWithProviders(
            <ActionItemsIndex
                {...pageProps([team] as ActionItemsPageProps['creatableTeams'])}
            />,
        );

        const bar = screen.getByRole('banner');
        const exportLink = screen.getByRole('link', { name: 'Export' });
        const create = screen.getByRole('button', { name: 'New action item' });

        expect(bar.contains(exportLink)).toBe(true);
        expect(
            exportLink.compareDocumentPosition(create) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(exportLink.getAttribute('href')).toBe(
            '/w/acme/action-items/export?due=overdue',
        );
    });

    it('shows Export alone without a team to add an item to', () => {
        renderWithProviders(<ActionItemsIndex {...pageProps([])} />);

        expect(
            screen
                .getByRole('banner')
                .contains(screen.getByRole('link', { name: 'Export' })),
        ).toBe(true);
        expect(
            screen.queryByRole('button', { name: 'New action item' }),
        ).toBeNull();
    });

    it('puts the search of the page in the topbar, holding its term', () => {
        renderWithProviders(<ActionItemsIndex {...pageProps([], 'runbook')} />);

        const search = screen.getByRole('searchbox', {
            name: 'Search action items',
        });

        expect(screen.getByRole('banner').contains(search)).toBe(true);
        expect((search as HTMLInputElement).value).toBe('runbook');
        expect(
            screen.getByRole('link', { name: 'Export' }).getAttribute('href'),
        ).toBe('/w/acme/action-items/export?due=overdue&q=runbook');
    });
});
