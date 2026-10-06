import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveSessionBanner } from '@/components/teams/live-session-banner';
import { renderWithProviders } from '@/test/render';
import type { RecentSessionRow } from '@/types';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Link: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

function live(values: Partial<RecentSessionRow> = {}): RecentSessionRow {
    return {
        kind: 'retro',
        id: 'r1',
        title: 'Sprint 42 retro',
        url: '/w/nordlys/retros/r1',
        state: 'live',
        updatedAt: '2026-09-30T09:00:00+00:00',
        participants: 6,
        meta: { phaseLabel: 'Writing', cards: 12 },
        outcome: null,
        roti: null,
        ...values,
    };
}

function banner(sessions: RecentSessionRow[]) {
    return renderWithProviders(
        <LiveSessionBanner
            sessions={sessions}
            allSessionsHref="/w/nordlys/teams/team-1/sessions"
        />,
    );
}

describe('LiveSessionBanner', () => {
    it('names the session in its live region once mounted, so it is announced, and links to it', async () => {
        const { container } = banner([live()]);

        expect(screen.getByRole('status').textContent).toBe('');

        await waitFor(() =>
            expect(screen.getByRole('status').textContent).not.toBe(''),
        );
        expect(screen.getByRole('status').textContent).toBe(
            'A session is in progress: Sprint 42 retro',
        );
        expect(
            container.querySelector('[data-slot="live-session-meta"]')
                ?.textContent,
        ).toBe('Retro · Writing · 12 cards');
        expect(
            screen.getByRole('link', { name: 'Join' }).getAttribute('href'),
        ).toBe('/w/nordlys/retros/r1');
    });

    it('paints the icon in the colour of the session kind, a game room as an icebreaker', () => {
        const tile = (kind: RecentSessionRow['kind']) => {
            const { container, unmount } = banner([live({ kind, meta: {} })]);
            const classes = Array.from(
                container.querySelector('[data-slot="live-session-kind"]')
                    ?.classList ?? [],
            );

            unmount();

            return classes;
        };

        expect(tile('poker')).toContain('bg-skrum-col-moss');
        expect(tile('game')).not.toEqual(tile('retro'));
        expect(tile('game').some((name) => name.startsWith('bg-'))).toBe(true);
    });

    it('shows nothing while no session is live, and has no button to dismiss it', () => {
        const { container, unmount } = banner([]);

        expect(container.innerHTML).toBe('');

        unmount();
        banner([live()]);

        expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    });

    it('says how many more are live', () => {
        const { unmount } = banner([live()]);

        expect(screen.queryByRole('link', { name: /more/ })).toBeNull();

        unmount();
        banner([
            live(),
            live({ kind: 'poker', id: 'g1', title: 'Refinement', meta: {} }),
            live({ kind: 'game', id: 'g2', title: 'Warm-up', meta: {} }),
        ]);

        expect(
            screen.getByRole('link', { name: '+2 more' }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/sessions');
        expect(screen.getAllByRole('link', { name: 'Join' })).toHaveLength(1);
        expect(
            screen.getByRole('link', { name: 'Join' }).getAttribute('href'),
        ).toBe('/w/nordlys/retros/r1');
    });
});
