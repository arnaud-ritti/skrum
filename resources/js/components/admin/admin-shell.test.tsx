import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AdminShell } from './admin-shell';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({
        actions,
        children,
    }: {
        actions?: ReactNode;
        children: ReactNode;
    }) => (
        <div>
            <header>{actions}</header>
            <main>{children}</main>
        </div>
    ),
}));

describe('AdminShell', () => {
    it('lists the sections that exist in a navigation named Administration', () => {
        renderWithProviders(
            <AdminShell active="admins">
                <p>content</p>
            </AdminShell>,
        );

        const links = within(
            screen.getByRole('navigation', {
                name: 'Administration',
                hidden: true,
            }),
        ).getAllByRole('link', { hidden: true });

        expect(links.map((link) => link.textContent)).toEqual([
            'Branding',
            'Admins',
        ]);
        expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([
            null,
            'page',
        ]);
    });

    it('shows the host of the instance under the navigation', () => {
        const { container } = renderWithProviders(
            <AdminShell active="branding">
                <p>content</p>
            </AdminShell>,
        );

        expect(
            container.querySelector('[data-slot=admin-host]')?.textContent,
        ).toBe(window.location.host);
    });

    it('puts the Self-host badge in the topbar, before the actions of the page', () => {
        renderWithProviders(
            <AdminShell
                active="branding"
                actions={<button type="button">Save</button>}
            >
                <p>content</p>
            </AdminShell>,
        );

        expect(screen.getByRole('banner').textContent).toBe('Self-hostSave');
        expect(screen.getByRole('main').textContent).toContain('content');
    });
});
