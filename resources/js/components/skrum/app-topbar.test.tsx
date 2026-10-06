import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppTopbar } from '@/components/skrum/app-topbar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { renderWithProviders } from '@/test/render';

function follows(first: Element | null, second: Element | null): boolean {
    return Boolean(
        (first as Node).compareDocumentPosition(second as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
}

describe('AppTopbar', () => {
    it('shows the title and no breadcrumb navigation', () => {
        renderWithProviders(
            <SidebarProvider>
                <AppTopbar title="Sessions" />
            </SidebarProvider>,
        );

        const banner = screen.getByRole('banner');
        const title = banner.querySelector('[data-slot="app-topbar-title"]');

        expect(title?.tagName).toBe('P');
        expect(title?.textContent).toBe('Sessions');
        expect(title?.className).toContain('truncate');
        expect(banner.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
        expect(banner.querySelector('a')).toBeNull();
        expect(screen.queryByRole('heading')).toBeNull();
    });

    it("shows the instance's mark before the title on a phone, linking home", () => {
        renderWithProviders(
            <SidebarProvider>
                <AppTopbar title="Sessions" homeHref="/w/nordlys" />
            </SidebarProvider>,
        );

        const banner = screen.getByRole('banner');
        const mark = screen.getByRole('link', { name: 'Skrüm' });

        expect(mark.getAttribute('href')).toBe('/w/nordlys');
        expect(mark.getAttribute('data-slot')).toBe('app-topbar-mark');
        expect(mark.className).toContain('md:hidden');
        expect(mark.querySelector('svg')).not.toBeNull();
        expect(
            follows(
                mark,
                banner.querySelector('[data-slot="app-topbar-title"]'),
            ),
        ).toBe(true);
    });

    it("shows the instance's own logo when it has one", () => {
        renderWithProviders(
            <SidebarProvider>
                <AppTopbar
                    title="Sessions"
                    homeHref="/w/nordlys"
                    brand={{
                        name: 'Nordlys',
                        logoLightUrl: '/brand/logo-light?v=1',
                        logoDarkUrl: null,
                    }}
                />
            </SidebarProvider>,
        );

        const mark = screen.getByRole('link', { name: 'Nordlys' });

        expect(mark.querySelector('img')?.getAttribute('src')).toBe(
            '/brand/logo-light?v=1',
        );
        expect(mark.querySelector('svg')).toBeNull();
    });

    it('keeps the search place and the actions', () => {
        renderWithProviders(
            <SidebarProvider>
                <AppTopbar
                    title="Sessions"
                    status={<span data-test="page-status">Draft</span>}
                    search={<input aria-label="Search" />}
                    actions={<button type="button">New session</button>}
                />
            </SidebarProvider>,
        );

        const banner = screen.getByRole('banner');
        const title = banner.querySelector('[data-slot="app-topbar-title"]');
        const status = banner.querySelector('[data-test="page-status"]');
        const search = banner.querySelector('[data-slot="app-topbar-search"]');
        const action = screen.getByRole('button', { name: 'New session' });

        expect(
            search?.querySelector('input[aria-label="Search"]'),
        ).toBeTruthy();
        expect(follows(title, status)).toBe(true);
        expect(follows(status, search)).toBe(true);
        expect(follows(search, action)).toBe(true);
    });
});
