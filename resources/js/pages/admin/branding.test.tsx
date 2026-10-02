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
    AdminShell: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

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
