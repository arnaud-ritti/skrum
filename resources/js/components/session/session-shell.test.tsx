import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReconnectingHints } from '@/components/session/reconnecting-hints';
import { SessionShell } from '@/components/session/session-shell';
import { SessionTitle } from '@/components/session/session-title';
import { renderWithProviders } from '@/test/render';

function renderShell(
    connection = { reconnecting: false, expired: false },
    kind: 'retro' | 'poker' | 'game' | 'whiteboard' = 'retro',
) {
    return renderWithProviders(
        <SessionShell
            kind={kind}
            title={<SessionTitle backHref="/teams/t1">Sprint 42</SessionTitle>}
            realtime="connected"
            connection={connection}
            rootProps={{ 'data-scene': '3:abc' } as never}
        >
            <p>board</p>
        </SessionShell>,
    );
}

describe('SessionShell', () => {
    it('emits one data-realtime element, inside the single main landmark', () => {
        const { container } = renderShell();
        const roots = container.querySelectorAll('[data-realtime]');

        expect(roots).toHaveLength(1);
        expect(roots[0].getAttribute('data-realtime')).toBe('connected');
        expect(roots[0].getAttribute('data-scene')).toBe('3:abc');
        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(screen.getByRole('main').contains(roots[0])).toBe(true);
    });

    it('shows a full-width banner while reconnecting and keeps one data-realtime', () => {
        const { container } = renderShell({
            reconnecting: true,
            expired: false,
        });
        const banner = screen.getByRole('status');

        expect(banner.getAttribute('data-variant')).toBe('banner');
        expect(banner.textContent).toContain('Reconnecting…');
        expect(banner.textContent).toContain(ReconnectingHints.retro);
        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(screen.queryByText(/kept locally/)).toBeNull();
        expect(screen.getByText('board').closest('[inert]')).toBeNull();
    });

    it('says what is true for each session type', () => {
        for (const kind of ['retro', 'poker', 'game', 'whiteboard'] as const) {
            const { unmount } = renderShell(
                { reconnecting: true, expired: false },
                kind,
            );

            expect(screen.getByRole('status').textContent).toContain(
                ReconnectingHints[kind],
            );
            unmount();
        }
    });

    it('keeps the compact state of the topbar out of the accessibility tree', () => {
        const { container } = renderShell({
            reconnecting: true,
            expired: false,
        });

        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(
            container.querySelector(
                'header [aria-hidden="true"] [data-slot="connection-state"]',
            ),
        ).not.toBeNull();
    });

    it('shows the expired alert with Reload and makes the content inert', () => {
        renderShell({ reconnecting: true, expired: true });

        const alert = screen.getByRole('alert');

        expect(alert.textContent).toContain('Your session has expired.');
        expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
        expect(screen.getByText('board').closest('[inert]')).not.toBeNull();
        expect(screen.queryByRole('status')).toBeNull();
    });
});

describe('SessionTitle', () => {
    it('renders the title as the page heading and a named back link', () => {
        renderShell();

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42',
        );
        expect(
            screen
                .getByRole('link', { name: 'Back to the team' })
                .getAttribute('href'),
        ).toBe('/teams/t1');
    });

    it('has no back link for a guest', () => {
        renderWithProviders(<SessionTitle>Sprint 42</SessionTitle>);

        expect(screen.queryByRole('link')).toBeNull();
    });
});
