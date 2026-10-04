import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import AppLayout from '@/layouts/skrum/app-layout';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, sidebarOpen: true } }),
}));

vi.mock('@/hooks/use-sidebar-model', () => ({
    useSidebarModel: () => ({
        team: { id: 't1', name: 'Atlas', initials: 'AT', membersCount: 8 },
        teams: [],
        workspace: { id: 'w1', name: 'Nordlys' },
        workspaces: [],
        newWorkspaceHref: '/workspaces/create',
        homeHref: '/dashboard',
        links: { dashboard: '/t1' },
    }),
}));

vi.mock('@/components/nav-user', () => ({ NavUser: () => null }));

vi.mock('@/components/action-items/notifications-menu', () => ({
    NotificationsMenu: () => <button type="button">Notifications</button>,
}));

vi.mock('@/hooks/use-global-search', () => ({
    useGlobalSearch: () => ({
        results: [],
        term: '',
        loading: false,
        failed: false,
    }),
}));

vi.mock('@/hooks/use-recent-sessions', () => ({
    useRecentSessions: () => ({ sessions: [], loading: false, failed: false }),
}));

beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.scrollIntoView = () => {};
});

function viewportFrom48rem(matches: boolean): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches: query === '(min-width: 768px)' ? matches : false,
                media: query,
                onchange: null,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
            }) as MediaQueryList,
    );
}

afterEach(() => vi.restoreAllMocks());

describe('AppLayout', () => {
    it('renders the actions at the end of the topbar, before the bell', () => {
        renderWithProviders(
            <AppLayout
                breadcrumbs={[{ title: 'Atlas', href: '/t1' }]}
                actions={<button type="button">New action item</button>}
            >
                <p>content</p>
            </AppLayout>,
        );

        const buttons = Array.from(
            screen.getByRole('banner').querySelectorAll('button'),
        ).map((button) => button.textContent);

        expect(buttons.slice(-2)).toEqual(['New action item', 'Notifications']);
        expect(screen.getByRole('main').textContent).toBe('content');
    });

    it('puts the status beside the breadcrumb, before the search and the actions', () => {
        renderWithProviders(
            <AppLayout
                breadcrumbs={[{ title: 'Atlas', href: '/t1' }]}
                status={<span data-test="page-status">Draft</span>}
                actions={<button type="button">Publish</button>}
            >
                <p>content</p>
            </AppLayout>,
        );

        const banner = screen.getByRole('banner');
        const status = banner.querySelector('[data-test="page-status"]');
        const breadcrumb = screen.getByRole('navigation', {
            name: 'Breadcrumb',
        });
        const search = banner.querySelector(
            '[data-test^="command-menu-button"]',
        );

        expect(status).not.toBeNull();
        expect(
            breadcrumb.compareDocumentPosition(status as Node) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            (status as Node).compareDocumentPosition(search as Node) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('shows the search and the bell alone without actions', () => {
        renderWithProviders(
            <AppLayout>
                <p>content</p>
            </AppLayout>,
        );

        const banner = screen.getByRole('banner');

        expect(
            banner.querySelectorAll('[data-test^="command-menu-button"]'),
        ).toHaveLength(2);
        expect(banner.querySelectorAll('button')).toHaveLength(4);
        expect(
            Array.from(banner.querySelectorAll('button')).at(-1)?.textContent,
        ).toBe('Notifications');
    });

    it('puts the page search in the topbar in place of the palette button from 48rem', () => {
        viewportFrom48rem(true);
        renderWithProviders(
            <AppLayout search={<input aria-label="Page search" />}>
                <p>content</p>
            </AppLayout>,
        );

        const banner = screen.getByRole('banner');

        expect(
            banner.querySelector('input[aria-label="Page search"]'),
        ).not.toBeNull();
        expect(
            banner.querySelector('[data-test="command-menu-button"]'),
        ).toBeNull();
        expect(
            banner.querySelector('[data-test="command-menu-button-compact"]')
                ?.className,
        ).toContain('md:hidden');

        fireEvent.keyDown(document.body, {
            key: 'k',
            metaKey: true,
            ctrlKey: true,
        });

        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.keyDown(document.body, { key: '/' });

        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('keeps the palette button and its Ctrl+K below 48rem, without the page search', () => {
        viewportFrom48rem(false);
        renderWithProviders(
            <AppLayout search={<input aria-label="Page search" />}>
                <p>content</p>
            </AppLayout>,
        );

        const banner = screen.getByRole('banner');

        expect(
            banner.querySelector('input[aria-label="Page search"]'),
        ).toBeNull();
        expect(
            banner.querySelector('[data-test="command-menu-button-compact"]'),
        ).not.toBeNull();

        fireEvent.keyDown(document.body, {
            key: 'k',
            metaKey: true,
            ctrlKey: true,
        });

        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('keeps the wide palette button and its Ctrl+K without a page search', () => {
        renderWithProviders(
            <AppLayout>
                <p>content</p>
            </AppLayout>,
        );

        expect(
            screen
                .getByRole('banner')
                .querySelector('[data-test="command-menu-button"]'),
        ).not.toBeNull();

        fireEvent.keyDown(document.body, {
            key: 'k',
            metaKey: true,
            ctrlKey: true,
        });

        expect(screen.getByRole('dialog')).toBeTruthy();
    });
});
