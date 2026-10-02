import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EstimationHistory,
    formatEstimateDate,
    pageRange,
} from '@/components/poker/estimation-history';
import type { EstimationHistoryProps } from '@/components/poker/estimation-history';
import type { PokerRound } from '@/lib/poker/types';
import { renderWithProviders } from '@/test/render';
import type { EstimatedTaskRow } from '@/types';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Link: ({
            href,
            children,
            preserveScroll: _preserveScroll,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
            preserveScroll?: boolean;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
        router: { get: mocks.get },
    };
});

function round(
    number: number,
    values: string[],
    anonymous = false,
): PokerRound {
    return {
        id: `round-${number}`,
        number,
        anonymous,
        revealedAt: '2026-09-30T09:00:00Z',
        revealReason: 'manual',
        timerEndsAt: null,
        version: 1,
        votesCount: values.length,
        votes: anonymous
            ? []
            : values.map((value, index) => ({
                  playerId: `p${index + 1}`,
                  value,
              })),
        myVote: null,
        result: {
            average: 5,
            mode: ['5'],
            consensus: false,
            nearestCard: '5',
            distribution: [
                { value: '3', count: 1 },
                { value: '5', count: 2 },
            ],
            median: 5,
            spread: { min: 3, max: 5 },
            agreement: 0.67,
            outliers: { low: [], high: [] },
        },
    };
}

const revoted: EstimatedTaskRow = {
    id: 'task-1',
    title: 'Email reminders for late action items',
    ticketKey: 'ATLAS-1285',
    gameId: 'game-1',
    gameTitle: 'Sprint 43 refinement',
    estimate: '8',
    roundsCount: 2,
    estimatedAt: '2026-09-30T10:00:00Z',
    deck: 'Fibonacci',
    voters: [
        { name: 'Camille Roux', avatarUrl: '/avatars/1.svg' },
        { name: 'Théo Martin', avatarUrl: '/avatars/2.svg' },
        { name: 'Inès Benali', avatarUrl: '/avatars/3.svg' },
        { name: 'Malik Koné', avatarUrl: '/avatars/4.svg' },
    ],
    votersCount: 4,
    rounds: [round(2, ['5', '5', '3']), round(1, ['3', '5', '5'])],
    players: [
        { id: 'p1', name: 'Camille Roux' },
        { id: 'p2', name: 'Théo Martin' },
    ],
};

const anonymous: EstimatedTaskRow = {
    ...revoted,
    id: 'task-2',
    title: 'Billing: proration on seat change',
    ticketKey: null,
    gameTitle: 'Sizing workshop',
    estimate: 'L',
    deck: 'T-shirt',
    roundsCount: 1,
    voters: [],
    votersCount: 6,
    rounds: [round(1, ['3', '5', '5'], true)],
    players: [],
};

const base: EstimationHistoryProps = {
    workspace: { id: 'w', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 'team-1', name: 'Atlas' },
    games: [
        { id: 'game-1', title: 'Sprint 43 refinement' },
        { id: 'game-2', title: 'Sizing workshop' },
    ],
    filters: { game: null, q: '' },
    tasks: [revoted, anonymous],
    pagination: { currentPage: 1, lastPage: 1, total: 2 },
    summary: { gamesCount: 2 },
};

function viewport(wide: boolean): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches: wide,
                media: query,
                onchange: null,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
                addListener: () => undefined,
                removeListener: () => undefined,
                dispatchEvent: () => false,
            }) as MediaQueryList,
    );
}

function rows(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>('[data-slot="estimate-row"]'),
    );
}

function lastVisit(): { url: string; options: Record<string, unknown> } {
    const [url, , options] = mocks.get.mock.calls.at(-1) as [
        string,
        unknown,
        Record<string, unknown>,
    ];

    return { url, options };
}

describe('EstimationHistory', () => {
    beforeEach(() => {
        mocks.get.mockReset();
        viewport(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('lists the tasks in a table: task and game, estimate, deck, date, voters, rounds', () => {
        renderWithProviders(<EstimationHistory {...base} />);

        expect(
            screen
                .getAllByRole('columnheader')
                .map((header) => header.textContent),
        ).toEqual(['Task', 'Estimate', 'Deck', 'Date', 'Voters', 'Rounds']);

        const [first] = rows();

        expect(first.tagName).toBe('TR');
        expect(
            within(first).getByText('Email reminders for late action items'),
        ).toBeTruthy();
        expect(within(first).getByText('Sprint 43 refinement')).toBeTruthy();
        expect(
            first.querySelector('[data-slot="estimate-value"]')?.textContent,
        ).toBe('8');
        expect(within(first).getByText('Fibonacci')).toBeTruthy();
        expect(
            within(first).getByText(
                formatEstimateDate(revoted.estimatedAt, 'en'),
            ),
        ).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Estimation history',
            }),
        ).toBeTruthy();
        expect(
            screen.getByText('2 tasks estimated by Atlas across 2 games'),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Back to the team' })
                .getAttribute('href'),
        ).toContain('/teams/team-1');
    });

    it('shows the key of the ticket under the title of an imported task, and none on a task written by hand', () => {
        renderWithProviders(<EstimationHistory {...base} />);

        const [first, second] = rows();

        expect(
            first.querySelector('[data-slot="estimate-ticket"]')?.textContent,
        ).toBe('ATLAS-1285');
        expect(within(first).getByText('Sprint 43 refinement')).toBeTruthy();
        expect(
            second.querySelector('[data-slot="estimate-ticket"]'),
        ).toBeNull();
        expect(within(second).getByText('Sizing workshop')).toBeTruthy();
    });

    it('shows the key of the ticket on the card of a phone', () => {
        viewport(false);
        renderWithProviders(<EstimationHistory {...base} />);

        expect(
            rows()[0].querySelector('[data-slot="estimate-ticket"]')
                ?.textContent,
        ).toBe('ATLAS-1285');
    });

    it('counts the games of the summary, in the singular for one game or one task, and names the team alone under a filter', () => {
        const { rerender } = renderWithProviders(
            <EstimationHistory {...base} summary={{ gamesCount: 1 }} />,
        );

        expect(
            screen.getByText('2 tasks estimated by Atlas in 1 game'),
        ).toBeTruthy();

        rerender(
            <EstimationHistory
                {...base}
                tasks={[revoted]}
                pagination={{ currentPage: 1, lastPage: 1, total: 1 }}
                summary={{ gamesCount: 1 }}
            />,
        );

        expect(
            screen.getByText('1 task estimated by Atlas in 1 game'),
        ).toBeTruthy();

        rerender(
            <EstimationHistory {...base} filters={{ game: 'game-1', q: '' }} />,
        );

        expect(screen.queryByText(/estimated by Atlas/)).toBeNull();
    });

    it('shows three voters as avatars with the count, and a warning badge on a task that was voted again', () => {
        renderWithProviders(<EstimationHistory {...base} />);

        const [first] = rows();
        const voters = first.querySelector<HTMLElement>(
            '[data-slot="estimate-voters"]',
        ) as HTMLElement;

        expect(
            voters.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(3);
        expect(within(voters).getByText('4 voters')).toBeTruthy();

        const rounds = first.querySelector<HTMLElement>(
            '[data-slot="estimate-rounds"]',
        ) as HTMLElement;

        expect(rounds.dataset.revoted).toBe('true');
        expect(rounds.textContent).toContain('2');
    });

    it('shows a count and no avatar for an anonymous round, and no warning for a single round', () => {
        renderWithProviders(<EstimationHistory {...base} />);

        const [, second] = rows();
        const voters = second.querySelector<HTMLElement>(
            '[data-slot="estimate-voters"]',
        ) as HTMLElement;

        expect(
            voters.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(0);
        expect(within(voters).getByText('6 voters')).toBeTruthy();
        expect(
            second.querySelector<HTMLElement>('[data-slot="estimate-rounds"]')
                ?.dataset.revoted,
        ).toBeUndefined();
    });

    it('opens the rounds of one task at a time, with the figures of each round', () => {
        renderWithProviders(<EstimationHistory {...base} />);

        const [show, showSecond] = screen.getAllByRole('button', {
            name: 'Show rounds',
        });

        expect(show.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(show);

        const hide = screen.getByRole('button', { name: 'Hide rounds' });

        expect(hide.getAttribute('aria-expanded')).toBe('true');
        expect(
            document.querySelectorAll('[data-slot="poker-round"]'),
        ).toHaveLength(2);
        expect(screen.getAllByText('Camille Roux:')).toHaveLength(2);
        expect(
            document.querySelectorAll('[data-slot="poker-round-figures"]'),
        ).toHaveLength(2);
        expect(screen.getAllByText('Median: 5')).toHaveLength(2);

        fireEvent.click(showSecond);

        expect(
            document.querySelectorAll('[data-slot="poker-round"]'),
        ).toHaveLength(1);
        expect(screen.getAllByText('Anonymous votes').length).toBeGreaterThan(
            0,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Hide rounds' }));

        expect(
            document.querySelectorAll('[data-slot="poker-round"]'),
        ).toHaveLength(0);
    });

    it('is a list of cards on a phone, with the same controls', () => {
        viewport(false);
        renderWithProviders(<EstimationHistory {...base} />);

        expect(screen.queryByRole('table')).toBeNull();

        const [first] = rows();

        expect(first.tagName).toBe('LI');
        expect(
            first.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(3);

        fireEvent.click(
            within(first).getByRole('button', { name: 'Show rounds' }),
        );

        expect(
            first.querySelectorAll('[data-slot="poker-round"]'),
        ).toHaveLength(2);
    });

    it('searches with the game filter kept, and trims the search', () => {
        renderWithProviders(
            <EstimationHistory {...base} filters={{ game: 'game-1', q: '' }} />,
        );

        fireEvent.change(screen.getByLabelText('Search tasks'), {
            target: { value: '  invoice ' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));

        const { url, options } = lastVisit();

        expect(url).toContain('game=game-1');
        expect(url).toContain('q=invoice');
        expect(url).not.toContain('page=');
        expect(options).toMatchObject({ preserveState: true, replace: true });
    });

    it('shows the search of the server again when the filters change', () => {
        const { rerender } = renderWithProviders(
            <EstimationHistory {...base} filters={{ game: null, q: 'old' }} />,
        );

        expect(
            (screen.getByLabelText('Search tasks') as HTMLInputElement).value,
        ).toBe('old');

        rerender(
            <EstimationHistory {...base} filters={{ game: null, q: 'new' }} />,
        );

        expect(
            (screen.getByLabelText('Search tasks') as HTMLInputElement).value,
        ).toBe('new');
    });

    it('says that nothing is estimated yet, and offers to clear the filters when there are some', () => {
        const { rerender } = renderWithProviders(
            <EstimationHistory
                {...base}
                tasks={[]}
                pagination={{ currentPage: 1, lastPage: 1, total: 0 }}
            />,
        );

        expect(screen.getByText('No estimated tasks yet.')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Clear filters' }),
        ).toBeNull();
        expect(
            screen.queryByRole('navigation', { name: 'Pagination' }),
        ).toBeNull();

        rerender(
            <EstimationHistory
                {...base}
                tasks={[]}
                filters={{ game: 'game-2', q: 'zzz' }}
                pagination={{ currentPage: 1, lastPage: 1, total: 0 }}
            />,
        );

        expect(screen.getByText('No estimated tasks yet.')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

        const { url } = lastVisit();

        expect(url).not.toContain('game=');
        expect(url).not.toContain('q=');
    });

    it('shows the range of the page, and the pagination only when there is more than one page', () => {
        const { rerender } = renderWithProviders(
            <EstimationHistory {...base} />,
        );

        expect(screen.getByText('1–2 of 2')).toBeTruthy();
        expect(
            screen.queryByRole('navigation', { name: 'Pagination' }),
        ).toBeNull();

        rerender(
            <EstimationHistory
                {...base}
                filters={{ game: null, q: 'mail' }}
                pagination={{ currentPage: 2, lastPage: 3, total: 5 }}
            />,
        );

        expect(screen.getByText('3–4 of 5')).toBeTruthy();

        const nav = screen.getByRole('navigation', { name: 'Pagination' });
        const previous = within(nav).getByRole('link', { name: 'Previous' });
        const next = within(nav).getByRole('link', { name: 'Next' });

        expect(previous.getAttribute('href')).toContain('q=mail');
        expect(previous.getAttribute('href')).not.toContain('page=');
        expect(next.getAttribute('href')).toContain('page=3');

        rerender(
            <EstimationHistory
                {...base}
                tasks={[revoted]}
                pagination={{ currentPage: 3, lastPage: 3, total: 5 }}
            />,
        );

        expect(screen.getByText('5–5 of 5')).toBeTruthy();
        expect(
            within(screen.getByRole('navigation', { name: 'Pagination' }))
                .getByRole('link', { name: 'Next' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
    });

    it('leaves a place for the page actions and for more filters', () => {
        renderWithProviders(
            <EstimationHistory
                {...base}
                actions={<button type="button">Export</button>}
                extraFilters={<button type="button">Period</button>}
            />,
        );

        expect(
            within(
                document.querySelector<HTMLElement>(
                    '[data-slot="estimation-history-actions"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'Export' }),
        ).toBeTruthy();
        expect(
            within(
                document.querySelector<HTMLElement>(
                    '[data-slot="estimation-history-filters"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'Period' }),
        ).toBeTruthy();
    });
});

describe('formatEstimateDate', () => {
    it('leaves the year out for a date of the current year', () => {
        const now = new Date('2026-10-02T12:00:00Z');

        expect(formatEstimateDate('2026-09-30T10:00:00Z', 'en-GB', now)).toBe(
            '30 Sept',
        );
        expect(formatEstimateDate('2025-09-30T10:00:00Z', 'en-GB', now)).toBe(
            '30 Sept 2025',
        );
    });
});

describe('pageRange', () => {
    it('counts from the page size on a full page and from the total on the last one', () => {
        expect(
            pageRange({ currentPage: 1, lastPage: 3, total: 120 }, 50),
        ).toEqual({ from: 1, to: 50 });
        expect(
            pageRange({ currentPage: 2, lastPage: 3, total: 120 }, 50),
        ).toEqual({ from: 51, to: 100 });
        expect(
            pageRange({ currentPage: 3, lastPage: 3, total: 120 }, 20),
        ).toEqual({ from: 101, to: 120 });
    });
});
