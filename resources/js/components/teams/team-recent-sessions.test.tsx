import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamRecentSessions } from '@/components/teams/team-recent-sessions';
import { renderWithProviders } from '@/test/render';
import type { RecentSessionRow } from '@/types';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
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
    };
});

function row(values: Partial<RecentSessionRow>): RecentSessionRow {
    return {
        kind: 'retro',
        id: 'retro-1',
        title: 'Sprint 41 retro',
        url: '/retros/retro-1',
        state: 'finished',
        updatedAt: '2026-09-18T10:00:00+00:00',
        participants: 9,
        meta: { phaseLabel: 'Completed', cards: 31 },
        outcome: { kind: 'actions', count: 6 },
        ...values,
    };
}

const rows: RecentSessionRow[] = [
    row({
        kind: 'poker',
        id: 'game-1',
        title: 'Sprint 43 refinement',
        url: '/poker/game-1',
        state: 'live',
        updatedAt: '2026-09-30T09:00:00+00:00',
        participants: 8,
        meta: { tasks: 6 },
        outcome: null,
    }),
    row({}),
    row({
        kind: 'survey',
        id: 'survey-1',
        title: 'Workload Q3',
        url: '/surveys/survey-1',
        state: 'upcoming',
        participants: 0,
        meta: { questions: 5 },
        outcome: null,
    }),
];

function section() {
    return renderWithProviders(
        <TeamRecentSessions
            rows={rows}
            allSessionsHref="/w/nordlys/teams/team-1/sessions"
        />,
    );
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('the recent sessions of a team', () => {
    it('is not rendered without a session', () => {
        const { container } = renderWithProviders(
            <TeamRecentSessions rows={[]} allSessionsHref="/sessions" />,
        );

        expect(container.innerHTML).toBe('');
    });

    it('lists each session with its kind, title, meta line, day and participants, and leads to all sessions', () => {
        const { container } = section();
        const lines = container.querySelectorAll(
            '#recent-sessions [data-test="recent-session"]',
        );

        expect(
            screen.getByRole('heading', { level: 2, name: 'Recent sessions' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'All sessions' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/sessions');
        expect(lines).toHaveLength(3);

        const [live, ended, draft] = Array.from(lines) as HTMLElement[];

        expect(
            within(live)
                .getByRole('link', { name: 'Sprint 43 refinement' })
                .getAttribute('href'),
        ).toBe('/poker/game-1');
        expect(live.textContent).toContain('Planning poker · 6 tasks');
        expect(live.textContent).toContain('Today');
        expect(live.querySelector('[data-kind="poker"]')).not.toBeNull();
        expect(ended.textContent).toContain('Retro · Completed · 31 cards');
        expect(ended.textContent).toContain('Sep 18');
        expect(
            ended.querySelector('[data-slot="recent-session-participants"]')
                ?.textContent,
        ).toBe('9');
        expect(draft.textContent).toContain('Survey · 5 questions');
    });

    it('gives the year of a session last active in another year', () => {
        renderWithProviders(
            <TeamRecentSessions
                rows={[row({ updatedAt: '2025-09-18T10:00:00+00:00' })]}
                allSessionsHref="/sessions"
            />,
        );

        expect(
            document.querySelector('[data-slot="recent-session-date"]')
                ?.textContent,
        ).toBe('Sep 18, 2025');
    });

    it('offers to join a live session, gives the outcome of an ended one and calls an unpublished survey a draft', () => {
        const { container } = section();
        const [live, ended, draft] = Array.from(
            container.querySelectorAll('[data-test="recent-session"]'),
        ) as HTMLElement[];

        expect(within(live).getByText('Live')).toBeTruthy();
        expect(
            within(live)
                .getByRole('link', {
                    name: /^Join\s*\(Sprint 43 refinement\)$/u,
                })
                .getAttribute('href'),
        ).toBe('/poker/game-1');
        expect(within(ended).getByText('Ended')).toBeTruthy();
        expect(within(ended).getByText('6 actions')).toBeTruthy();
        expect(within(ended).queryByRole('link', { name: /Join/ })).toBeNull();
        expect(within(draft).getByText('Draft')).toBeTruthy();
        expect(within(draft).queryByRole('link', { name: /Join/ })).toBeNull();
    });

    it('turns the rows into cards below 40rem: the header, the day and the participants are hidden there', () => {
        const { container } = section();
        const [first] = Array.from(
            container.querySelectorAll('[data-test="recent-session"]'),
        );

        expect(container.querySelector('thead')?.className).toContain(
            'max-sm:hidden',
        );
        expect(first.className).toContain('max-sm:grid');
        expect(
            first.querySelector('[data-slot="recent-session-date"]')?.className,
        ).toContain('max-sm:hidden');
        expect(
            first.querySelector('[data-slot="recent-session-participants"]')
                ?.className,
        ).toContain('max-sm:hidden');
    });
});
