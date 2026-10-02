import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TeamPokerSection } from '@/components/teams/team-poker-section';
import { renderWithProviders } from '@/test/render';
import type { PokerGameSummary } from '@/types';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
        router: {
            post: mocks.post,
            patch: mocks.patch,
            delete: mocks.delete,
            reload: mocks.reload,
        },
    };
});

const active: PokerGameSummary = {
    id: 'game-1',
    title: 'Sprint 43 refinement',
    deckLabel: 'Fibonacci',
    tasksCount: 3,
    estimatedCount: 1,
    totalPoints: 5,
    endedAt: null,
    lastActivityAt: new Date(Date.now() - 12 * 60_000).toISOString(),
};

const untouched: PokerGameSummary = {
    ...active,
    id: 'game-2',
    title: 'Billing epic sizing',
    deckLabel: 'T-shirt sizes',
    estimatedCount: 0,
    totalPoints: null,
};

const ended: PokerGameSummary = {
    ...active,
    id: 'game-3',
    title: 'Mobile app spikes',
    endedAt: '2026-09-20T10:00:00+00:00',
};

function section(props: Partial<Parameters<typeof TeamPokerSection>[0]> = {}) {
    return renderWithProviders(
        <TeamPokerSection
            workspaceSlug="nordlys"
            teamId="team-1"
            games={[active, untouched, ended]}
            presence={{}}
            {...props}
        />,
    );
}

function rowOf(title: string): HTMLElement {
    return screen
        .getByRole('link', { name: title })
        .closest('tr') as HTMLElement;
}

describe('the planning poker section of a team', () => {
    it('keeps "Estimation history" in the header and "Saved decks" in the "…" menu', async () => {
        const user = userEvent.setup();

        section({ games: [] });

        expect(
            screen
                .getByRole('link', { name: 'Estimation history' })
                .getAttribute('href'),
        ).toMatch(/\/teams\/team-1\/estimates$/);
        expect(screen.queryByText('Saved decks')).toBeNull();
        expect(screen.getByText('No games yet.')).toBeTruthy();

        await user.click(
            screen.getByRole('button', { name: 'Planning poker actions' }),
        );

        expect(
            screen
                .getByRole('menuitem', { name: 'Saved decks' })
                .getAttribute('href'),
        ).toMatch(/\/poker-decks$/);
    });

    it('groups active and ended games, each counted', () => {
        section();

        expect(screen.getByText('Active games · 2')).toBeTruthy();
        expect(screen.getByText('Ended games · 1')).toBeTruthy();
        expect(
            document.querySelectorAll('[data-slot="team-poker-game"]'),
        ).toHaveLength(3);
    });

    it('keeps the tasks, estimates and points of a game in one text node', () => {
        section();

        const row = rowOf('Sprint 43 refinement');

        expect(
            within(row).getByText('3 tasks · 1 estimated · 5 points'),
        ).toBeTruthy();
        expect(within(row).getByText('Fibonacci')).toBeTruthy();
        expect(within(row).getByText('5 pts')).toBeTruthy();
        expect(within(row).getByText('12 minutes ago')).toBeTruthy();
        expect(
            within(rowOf('Billing epic sizing')).getByText(
                '3 tasks · 0 estimated',
            ),
        ).toBeTruthy();
        expect(
            within(rowOf('Billing epic sizing')).getByText('—'),
        ).toBeTruthy();
    });

    it('folds the deck and the last activity into the line under the name, for the widths without columns', () => {
        section();

        const folded = within(rowOf('Sprint 43 refinement')).getByText(
            '· Fibonacci · 12 minutes ago',
        );

        expect(folded.className).toContain('sm:hidden');
    });

    it('shows no points for a game with tasks and no estimate yet', () => {
        section({
            games: [{ ...untouched, totalPoints: 0 }],
        });

        const row = rowOf('Billing epic sizing');

        expect(within(row).getByText('3 tasks · 0 estimated')).toBeTruthy();
        expect(within(row).getByText('—')).toBeTruthy();
        expect(within(row).queryByText(/0 pts/)).toBeNull();
    });

    it('keeps the players in the room while the presence is fetched again', () => {
        const { rerender, container } = section({
            presence: { 'game-1': 2 },
        });

        rerender(
            <TeamPokerSection
                workspaceSlug="nordlys"
                teamId="team-1"
                games={[active, untouched, ended]}
            />,
        );

        expect(
            container.querySelector('[data-slot="poker-presence-loading"]'),
        ).toBeNull();
        expect(
            within(rowOf('Sprint 43 refinement')).getByRole('link', {
                name: /^Join/,
            }),
        ).toBeTruthy();
    });

    it('shows a skeleton while the presence is on its way, then the players in the room', () => {
        const { rerender, container } = section({ presence: undefined });

        expect(
            container.querySelectorAll('[data-slot="poker-presence-loading"]'),
        ).toHaveLength(2);
        expect(
            within(rowOf('Mobile app spikes')).queryByText(/in the room/),
        ).toBeNull();

        rerender(
            <TeamPokerSection
                workspaceSlug="nordlys"
                teamId="team-1"
                games={[active, untouched, ended]}
                presence={{ 'game-1': 2, 'game-2': 0 }}
            />,
        );

        expect(
            container.querySelector('[data-slot="poker-presence-loading"]'),
        ).toBeNull();
        expect(
            within(rowOf('Sprint 43 refinement')).getByText(/2 in the room/),
        ).toBeTruthy();
        expect(
            within(rowOf('Billing epic sizing')).queryByText(/in the room/),
        ).toBeNull();
        expect(
            within(rowOf('Sprint 43 refinement'))
                .getByRole('link', { name: /^Join/ })
                .getAttribute('href'),
        ).toBe('/poker/game-1');
        expect(
            within(rowOf('Billing epic sizing')).getByRole('link', {
                name: /^Open the game/,
            }),
        ).toBeTruthy();
    });

    it('shows nothing about presence when the presence server did not answer', () => {
        const { container } = section({ presence: null });

        expect(
            container.querySelector('[data-slot="poker-presence-loading"]'),
        ).toBeNull();
        expect(screen.queryByText(/in the room/)).toBeNull();
    });
});
