import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import AdminGeneral from './general';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
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

describe('AdminGeneral page', () => {
    it('hands the unsaved-changes bar to the topbar of the admin shell', () => {
        renderWithProviders(
            <AdminGeneral
                requireEmailVerification={null}
                signupMode={null}
                allowedEmailDomains={null}
                defaults={{
                    signupMode: 'invite',
                    allowedEmailDomains: [],
                    requireEmailVerification: true,
                }}
                updateCheckEnabled={false}
                version="1.8.2"
                versionStatus={{
                    state: 'unknown',
                    latest: null,
                    checkedAt: null,
                    releaseUrl: null,
                }}
                image="ghcr.io/arnaud-ritti/skrum"
            />,
        );

        const bar = screen.getByRole('banner');

        expect(bar.querySelector('[data-slot=unsaved-bar]')).not.toBeNull();
        expect(
            bar.querySelector('button[type=submit]')?.getAttribute('form'),
        ).toBe(screen.getByRole('form', { name: 'General' }).id);
    });
});
