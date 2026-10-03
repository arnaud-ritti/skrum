import { within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { AuditTable } from './audit-table';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const Now = Date.parse('2026-10-15T12:00:00Z');

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
    return {
        id: 'event-1',
        action: 'user_deactivated',
        group: 'accounts',
        actor: { id: 'user-1', name: 'Nadia', avatarUrl: null },
        subject: { type: 'User', id: 'user-2', label: 'Malik' },
        properties: {},
        ownerName: null,
        ip: '203.0.113.7',
        at: '2026-10-15T11:52:00Z',
        ...overrides,
    };
}

function table() {
    return within(
        document.querySelector('[data-slot="audit-table"]') as HTMLElement,
    );
}

describe('AuditTable', () => {
    it('renders the time, actor, sentence, subject and address of an event', () => {
        renderWithProviders(<AuditTable events={[event()]} now={Now} />);

        const row = table();
        const time = row.getByText('8 minutes ago');

        expect(time.tagName).toBe('TIME');
        expect(time.getAttribute('title')).toContain('2026');
        expect(row.getByText('Nadia')).toBeTruthy();
        expect(row.getByText('deactivated Malik')).toBeTruthy();
        expect(row.getByText('Malik')).toBeTruthy();
        expect(row.getByText('203.0.113.7').className).toContain('font-mono');
    });

    it('shows the system for an event without actor and a dash without address', () => {
        renderWithProviders(
            <AuditTable
                events={[
                    event({
                        actor: null,
                        subject: null,
                        ip: null,
                        action: 'signed_in',
                    }),
                ]}
                now={Now}
            />,
        );

        const row = table();

        expect(row.getByText('System')).toBeTruthy();
        expect(row.getAllByText('—')).toHaveLength(2);
    });

    it('lists the events as cards too, for a narrow container', () => {
        renderWithProviders(
            <AuditTable
                events={[
                    event(),
                    event({ id: 'event-2', action: 'signed_in' }),
                ]}
                now={Now}
            />,
        );

        const cards = within(
            document.querySelector('[data-slot="audit-cards"]') as HTMLElement,
        );

        expect(cards.getAllByRole('listitem')).toHaveLength(2);
        expect(cards.getByText('signed in')).toBeTruthy();
    });
});
