import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEvent } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { AuditFilters, auditEventsUrl, pageActors } from './audit-filters';

const router = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router,
}));

const Nadia = '0b6e5a8e-2f8e-4f6a-9d1e-1a2b3c4d5e6f';
const Malik = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';

function event(id: string, actor: AuditEvent['actor']): AuditEvent {
    return {
        id,
        action: 'signed_in',
        group: 'signIn',
        actor,
        subject: null,
        properties: {},
        ownerName: null,
        ip: null,
        at: '2026-10-15T11:52:00Z',
    };
}

const events = [
    event('1', { id: Nadia, name: 'Nadia', avatarUrl: null }),
    event('2', { id: Malik, name: 'Malik', avatarUrl: null }),
    event('3', { id: Nadia, name: 'Nadia', avatarUrl: null }),
    event('4', null),
    event('5', { id: null, name: 'Ines', avatarUrl: null }),
];

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    router.get.mockReset();
});

describe('auditEventsUrl', () => {
    it('leaves the defaults out of the address', () => {
        expect(auditEventsUrl({ group: null, actor: null })).toBe(
            '/admin/audit-log',
        );
    });

    it('keeps the group, the actor and the page', () => {
        expect(auditEventsUrl({ group: 'tokens', actor: Nadia }, 2)).toBe(
            `/admin/audit-log?group=tokens&actor=${Nadia}&page=2`,
        );
    });
});

describe('pageActors', () => {
    it('lists each actor with an account once, by name', () => {
        expect(pageActors(events).map((actor) => actor.name)).toEqual([
            'Malik',
            'Nadia',
        ]);
    });
});

describe('AuditFilters', () => {
    it('filters by group, keeping the actor', async () => {
        renderWithProviders(
            <AuditFilters
                filters={{ group: null, actor: Nadia }}
                events={events}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', { name: 'Events' }));
        await userEvent.click(screen.getByRole('option', { name: 'Tokens' }));

        expect(router.get).toHaveBeenCalledWith(
            `/admin/audit-log?group=tokens&actor=${Nadia}`,
            {},
            expect.objectContaining({ preserveState: true }),
        );
    });

    it('goes back to every group', async () => {
        renderWithProviders(
            <AuditFilters
                filters={{ group: 'tokens', actor: null }}
                events={events}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', { name: 'Events' }));
        await userEvent.click(screen.getByRole('option', { name: 'All' }));

        expect(router.get).toHaveBeenCalledWith(
            '/admin/audit-log',
            {},
            expect.anything(),
        );
    });

    it('searches the actors of the page by name and filters by the one chosen', async () => {
        renderWithProviders(
            <AuditFilters
                filters={{ group: 'signIn', actor: null }}
                events={events}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', { name: 'Actor' }));
        await userEvent.type(
            screen.getByPlaceholderText('Search by name'),
            'mal',
        );

        expect(screen.queryByRole('option', { name: 'Nadia' })).toBeNull();

        await userEvent.click(screen.getByRole('option', { name: 'Malik' }));

        expect(router.get).toHaveBeenCalledWith(
            `/admin/audit-log?group=signIn&actor=${Malik}`,
            {},
            expect.anything(),
        );
    });

    it('shows the chosen actor and goes back to everyone', async () => {
        renderWithProviders(
            <AuditFilters
                filters={{ group: null, actor: Malik }}
                events={events}
            />,
        );

        const picker = screen.getByRole('combobox', { name: 'Actor' });

        expect(picker.textContent).toBe('Malik');

        await userEvent.click(picker);
        await userEvent.click(screen.getByRole('option', { name: 'Everyone' }));

        expect(router.get).toHaveBeenCalledWith(
            '/admin/audit-log',
            {},
            expect.anything(),
        );
    });
});
