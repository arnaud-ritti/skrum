import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { sampleProps } from '@/components/admin/branding/samples';
import { renderWithProviders } from '@/test/render';
import AdminBranding from './branding';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: {}, auth: { user: { name: 'Ada Admin' } } },
    }),
    Head: () => null,
}));

vi.mock('@/components/admin/admin-shell', () => ({
    AdminShell: ({
        actions,
        children,
    }: {
        actions?: ReactNode;
        children: ReactNode;
    }) => (
        <div>
            <header>{actions}</header>
            {children}
        </div>
    ),
}));

describe('AdminBranding page', () => {
    it('hands the unsaved-changes bar to the topbar of the admin shell', () => {
        renderWithProviders(<AdminBranding {...sampleProps()} />);

        const bar = screen.getByRole('banner');

        expect(bar.querySelector('[data-slot=unsaved-bar]')).not.toBeNull();
        expect(
            bar.querySelector('button[type=submit]')?.getAttribute('form'),
        ).toBe(screen.getByRole('form', { name: 'Branding' }).id);
    });
});

describe('AdminBranding page focus', () => {
    it('leaves the focus alone on the first load', () => {
        renderWithProviders(<AdminBranding {...sampleProps()} />);

        expect(document.body).toBe(document.activeElement);
    });

    it('moves the focus to the form after a save remounts it', () => {
        const { rerender } = renderWithProviders(
            <AdminBranding {...sampleProps()} />,
        );

        rerender(
            <AdminBranding {...sampleProps({ displayName: 'Nordlys' })} />,
        );

        expect(document.activeElement).toBe(
            screen.getByRole('form', { name: 'Branding' }).parentElement,
        );
        expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
    });
});
