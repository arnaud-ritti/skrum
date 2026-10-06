import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Leaderboard } from '@/components/skrum/games-leaderboard';
import type { GamesLeaderboardEntry } from '@/components/skrum/games-leaderboard';
import { renderWithProviders } from '@/test/render';

function entries(count: number): GamesLeaderboardEntry[] {
    return Array.from({ length: count }, (_, index) => ({
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        avatarUrl: `/avatars/${index + 1}.png`,
        points: 1000 - index,
        wins: 1,
        gamesPlayed: 5,
    }));
}

describe('Leaderboard', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders the podium in DOM order 1, 2, 3 and the list from rank 4', () => {
        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(6)}
            />,
        );

        const podium = within(screen.getByRole('list', { name: 'Podium' }));
        const places = podium.getAllByRole('listitem');

        expect(places.map((place) => place.getAttribute('data-place'))).toEqual(
            ['1', '2', '3'],
        );
        expect(within(places[0]).getByText('Player 1')).toBeTruthy();
        expect(
            document.querySelectorAll('[data-slot="leaderboard-row"]'),
        ).toHaveLength(3);
        expect(
            screen.getByText('Player 4').closest('li')?.textContent,
        ).toContain('5 games · 1 win');
    });

    it('passes avatar urls as image sources', async () => {
        class LoadedImage extends EventTarget {
            complete = false;
            naturalWidth = 8;
            referrerPolicy = '';
            crossOrigin: string | null = null;
            set src(_value: string) {
                queueMicrotask(() => {
                    this.complete = true;
                    this.dispatchEvent(new Event('load'));
                });
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        renderWithProviders(
            <Leaderboard
                period="all"
                onPeriodChange={vi.fn()}
                entries={entries(1)}
            />,
        );

        const image = await waitFor(() => {
            const found = document.querySelector('img');

            expect(found).not.toBeNull();

            return found as HTMLImageElement;
        });

        expect(image.getAttribute('src')).toBe('/avatars/1.png');
    });

    it('marks me in the list and on the podium', () => {
        const { rerender } = renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(6)}
                currentUserId="u5"
            />,
        );

        expect(
            document.querySelector('[data-slot="leaderboard-row"][data-me]')
                ?.textContent,
        ).toContain('Player 5');

        rerender(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(6)}
                currentUserId="u2"
            />,
        );

        expect(
            document
                .querySelector('[data-slot="podium-place"][data-me]')
                ?.getAttribute('data-place'),
        ).toBe('2');
        expect(
            document.querySelector('[data-slot="leaderboard-row"][data-me]'),
        ).toBeNull();
    });

    it('keeps the podium frame with fewer than 3 players', () => {
        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(1)}
            />,
        );

        expect(
            document.querySelectorAll('[data-slot="podium-place"]'),
        ).toHaveLength(1);
        expect(
            document.querySelectorAll('[data-slot="podium-empty"]'),
        ).toHaveLength(2);
        expect(
            document.querySelector('[data-slot="leaderboard-list"]'),
        ).toBeNull();
    });

    it('shows the empty state and keeps the period toggle', () => {
        renderWithProviders(
            <Leaderboard period="all" onPeriodChange={vi.fn()} entries={[]} />,
        );

        expect(screen.getByText('No games played yet.')).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Last 30 days' })).toBeTruthy();
    });

    it('is busy while entries are loading and shows a retry on error', () => {
        const onRetry = vi.fn();
        const { rerender } = renderWithProviders(
            <Leaderboard period="30d" onPeriodChange={vi.fn()} />,
        );

        expect(screen.getByRole('tabpanel').getAttribute('aria-busy')).toBe(
            'true',
        );

        rerender(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                error
                onRetry={onRetry}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('points each period tab at a panel that exists and dims stale scores while loading', () => {
        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(4)}
                loading
            />,
        );

        for (const tab of screen.getAllByRole('tab')) {
            expect(
                document.getElementById(
                    tab.getAttribute('aria-controls') ?? '',
                ),
            ).not.toBeNull();
        }

        expect(screen.getByRole('tabpanel').className).toContain('opacity-60');
    });

    it('writes points in the language of the page', () => {
        const before = document.documentElement.lang;
        document.documentElement.lang = 'de';

        try {
            renderWithProviders(
                <Leaderboard
                    period="30d"
                    onPeriodChange={vi.fn()}
                    entries={entries(1)}
                />,
            );

            expect(screen.getAllByText(/1\.000/).length).toBeGreaterThan(0);
        } finally {
            document.documentElement.lang = before;
        }
    });

    it('changes period from the keyboard', async () => {
        const onPeriodChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={onPeriodChange}
                entries={entries(4)}
            />,
        );

        screen.getByRole('tab', { name: 'Last 30 days' }).focus();
        await user.keyboard('{ArrowRight}');

        expect(onPeriodChange).toHaveBeenCalledWith('all');
    });

    it('scrolls 200 entries inside the card', () => {
        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={vi.fn()}
                entries={entries(200)}
            />,
        );

        expect(
            document.querySelectorAll('[data-slot="leaderboard-row"]'),
        ).toHaveLength(197);
        expect(
            document
                .querySelector('[data-slot="leaderboard-list"]')
                ?.className.includes('overflow-y-auto'),
        ).toBe(true);
    });

    it('shows the streak of a player on the podium, and none below two weeks', () => {
        const list = entries(3);

        list[0].streak = 2;
        list[1].streak = 1;

        renderWithProviders(
            <Leaderboard
                period="30d"
                onPeriodChange={() => {}}
                entries={list}
            />,
        );

        const first = document.querySelector(
            '[data-slot="podium-place"][data-place="1"]',
        );
        const second = document.querySelector(
            '[data-slot="podium-place"][data-place="2"]',
        );

        expect(first?.textContent).toContain('2-week streak');
        expect(second?.textContent).not.toContain('streak');
    });
});
