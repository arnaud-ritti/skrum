import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent, AuditLogPageProps } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import AdminAuditLog from './audit-log';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Head: () => null,
    router: { get: vi.fn() },
}));

vi.mock('@/components/admin/admin-shell', () => ({
    AdminShell: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

const signedIn: AuditEvent = {
    id: 'event-1',
    action: 'signed_in',
    group: 'signIn',
    actor: { id: 'user-1', name: 'Nadia', avatarUrl: null },
    subject: null,
    properties: {},
    ownerName: null,
    ip: null,
    at: '2026-10-15T11:52:00Z',
};

function props(overrides: Partial<AuditLogPageProps> = {}): AuditLogPageProps {
    return {
        events: { data: [signedIn], current_page: 1, last_page: 1, total: 1 },
        filters: { group: null, actor: null },
        retentionDays: 365,
        ...overrides,
    };
}

describe('AdminAuditLog', () => {
    it('says how long the events are kept', () => {
        renderWithProviders(<AdminAuditLog {...props()} />);

        expect(screen.getByText('Events are kept 365 days.')).toBeTruthy();
        expect(
            document.querySelector('[data-slot="audit-table"]'),
        ).not.toBeNull();
    });

    it('says nothing is recorded yet on an empty log', () => {
        renderWithProviders(
            <AdminAuditLog
                {...props({
                    events: {
                        data: [],
                        current_page: 1,
                        last_page: 1,
                        total: 0,
                    },
                })}
            />,
        );

        expect(screen.getByText('No event recorded yet.')).toBeTruthy();
    });

    it('says no event matches when a filter empties the page', () => {
        renderWithProviders(
            <AdminAuditLog
                {...props({
                    events: {
                        data: [],
                        current_page: 1,
                        last_page: 1,
                        total: 0,
                    },
                    filters: { group: 'tokens', actor: null },
                })}
            />,
        );

        expect(
            screen.getByText('No event matches these filters.'),
        ).toBeTruthy();
    });

    it('links the pages with the filters', () => {
        renderWithProviders(
            <AdminAuditLog
                {...props({
                    events: {
                        data: [signedIn],
                        current_page: 1,
                        last_page: 3,
                        total: 120,
                    },
                    filters: { group: 'signIn', actor: null },
                })}
            />,
        );

        expect(
            screen.getByRole('link', { name: /2/ }).getAttribute('href'),
        ).toBe('/admin/audit-log?group=signIn&page=2');
    });
});
