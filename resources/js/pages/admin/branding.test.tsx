import { screen } from '@testing-library/react';
import { useEffect } from 'react';
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

const shellMounts = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/components/admin/admin-shell', () => ({
    AdminShell: function AdminShell({
        actions,
        children,
    }: {
        actions?: ReactNode;
        children: ReactNode;
    }) {
        useEffect(() => {
            shellMounts.count++;
        }, []);

        return (
            <div>
                <header>{actions}</header>
                {children}
            </div>
        );
    },
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

describe('AdminBranding page shell', () => {
    it('keeps the admin shell mounted when a save remounts the form', () => {
        shellMounts.count = 0;

        const { rerender } = renderWithProviders(
            <AdminBranding {...sampleProps()} />,
        );

        rerender(
            <AdminBranding {...sampleProps({ displayName: 'Nordlys' })} />,
        );

        expect(shellMounts.count).toBe(1);
        expect(
            screen.getByRole('banner').querySelector('[data-slot=unsaved-bar]'),
        ).not.toBeNull();
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
