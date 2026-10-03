import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionShell } from '@/components/session/session-shell';
import { SessionTitle } from '@/components/session/session-title';
import { renderWithProviders } from '@/test/render';

const ReconnectingHints = {
    retro: 'Live updates are paused. What you see may be out of date.',
    poker: 'Live updates are paused. What you see may be out of date.',
    game: 'Live updates are paused. The round may have moved on.',
    whiteboard:
        "Live updates are paused. Other people's changes appear when the connection returns.",
    survey: 'Your answers are saved as you give them; the counter is paused.',
} as const;

function renderShell(
    connection = { reconnecting: false, expired: false },
    kind: keyof typeof ReconnectingHints = 'retro',
    observing = false,
) {
    return renderWithProviders(
        <SessionShell
            kind={kind}
            observing={observing}
            title={<SessionTitle backHref="/teams/t1">Sprint 42</SessionTitle>}
            realtime="connected"
            connection={connection}
            rootProps={{ 'data-scene': '3:abc' }}
        >
            <p>board</p>
        </SessionShell>,
    );
}

describe('SessionShell', () => {
    it('shows an observer the line "You are observing this session." above the session', () => {
        renderShell(undefined, 'poker', true);

        const notice = screen.getByText('You are observing this session.');

        expect(notice.closest('[data-slot="observer-notice"]')).not.toBeNull();
        expect(
            notice.compareDocumentPosition(screen.getByText('board')) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('shows no observer line to someone who takes part', () => {
        renderShell();

        expect(
            screen.queryByText('You are observing this session.'),
        ).toBeNull();
    });

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
        for (const kind of [
            'retro',
            'poker',
            'game',
            'whiteboard',
            'survey',
        ] as const) {
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

    it('shows "Synced" in the header while connected, outside the single data-realtime', () => {
        const { container } = renderShell();
        const synced = container.querySelector(
            'header [data-slot="session-synced"]',
        );

        expect(synced?.textContent).toBe('Synced');
        expect(synced?.querySelector('[data-realtime]')).toBeNull();
        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows no "Synced" while connecting, reconnecting or expired', () => {
        const connecting = renderWithProviders(
            <SessionShell
                kind="poker"
                title="Sprint 42"
                realtime="connecting"
                connection={{ reconnecting: false, expired: false }}
            >
                <p>board</p>
            </SessionShell>,
        );

        expect(screen.queryByText('Synced')).toBeNull();
        connecting.unmount();

        const reconnecting = renderShell({
            reconnecting: true,
            expired: false,
        });

        expect(screen.queryByText('Synced')).toBeNull();
        reconnecting.unmount();

        renderShell({ reconnecting: false, expired: true });

        expect(screen.queryByText('Synced')).toBeNull();
    });

    it('ends the header with the viewer, a guest named as a guest', () => {
        const { container } = renderWithProviders(
            <SessionShell
                kind="poker"
                title="Sprint 42"
                realtime="connected"
                connection={{ reconnecting: false, expired: false }}
                self={{ name: 'Yuki Tanaka', isGuest: true }}
            >
                <p>board</p>
            </SessionShell>,
        );
        const header = container.querySelector('header');
        const self = container.querySelector('[data-slot="session-self"]');

        expect(header?.lastElementChild).toBe(self);
        expect(
            screen.getByRole('img', { name: 'Yuki Tanaka (Guest)' }),
        ).toBeTruthy();
        expect(self?.className).toContain('hidden');
        expect(self?.className).toContain('md:inline-flex');
    });

    it('shows nobody at the end of the header of a guest it was not told about', () => {
        const { container } = renderShell();

        expect(
            container.querySelector('[data-slot="session-self"]'),
        ).toBeNull();
    });

    it('opens the header with the logo, linked to the team, when the screen has no rail', () => {
        const { container } = renderWithProviders(
            <SessionShell
                kind="whiteboard"
                chrome="logo"
                homeHref="/teams/t1"
                title="Sprint board"
                realtime="connected"
                connection={{ reconnecting: false, expired: false }}
            >
                <p>board</p>
            </SessionShell>,
        );
        const header = container.querySelector('header');
        const logo = screen.getByRole('link', { name: 'Back to the team' });

        expect(header?.firstElementChild).toBe(logo);
        expect(logo.getAttribute('href')).toBe('/teams/t1');
        expect(container.querySelector('[data-slot="sidebar"]')).toBeNull();
    });

    it('shows a guest the logo without a link', () => {
        const { container } = renderWithProviders(
            <SessionShell
                kind="whiteboard"
                chrome="logo"
                homeHref={null}
                title="Sprint board"
                realtime="connected"
                connection={{ reconnecting: false, expired: false }}
            >
                <p>board</p>
            </SessionShell>,
        );

        expect(screen.queryByRole('link')).toBeNull();
        expect(
            container.querySelector('header [data-slot="session-logo"]'),
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

    it('writes the team and the session type above the title, and lets the line go on a phone', () => {
        const { container } = renderWithProviders(
            <SessionTitle overline="Atlas · Planning poker">
                Sprint 42
            </SessionTitle>,
        );
        const overline = container.querySelector(
            '[data-slot="session-overline"]',
        );

        expect(overline?.textContent).toBe('Atlas · Planning poker');
        expect(overline?.className).toContain('hidden');
        expect(overline?.className).toContain('md:block');
        expect(overline?.nextElementSibling?.tagName).toBe('H1');
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42',
        );
        expect(
            screen.getByRole('heading', { level: 1 }).parentElement?.tagName,
        ).toBe('SPAN');
    });

    it('leads to the title with a breadcrumb: links for a member, text for a guest', () => {
        const { unmount } = renderWithProviders(
            <SessionTitle
                crumbs={[
                    { label: 'Atlas', href: '/teams/t1' },
                    { label: 'Whiteboards', href: '/teams/t1#sessions' },
                ]}
            >
                Sprint board
            </SessionTitle>,
        );
        const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });

        expect(trail.className).toContain('hidden');
        expect(trail.className).toContain('md:block');
        expect(
            screen.getByRole('link', { name: 'Atlas' }).getAttribute('href'),
        ).toBe('/teams/t1');
        expect(
            screen
                .getByRole('link', { name: 'Whiteboards' })
                .getAttribute('href'),
        ).toBe('/teams/t1#sessions');
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint board',
        );
        unmount();

        renderWithProviders(
            <SessionTitle crumbs={[{ label: 'Whiteboards' }]}>
                Sprint board
            </SessionTitle>,
        );

        expect(screen.queryByRole('link')).toBeNull();
        expect(
            screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent,
        ).toBe('Whiteboards');
    });
});
