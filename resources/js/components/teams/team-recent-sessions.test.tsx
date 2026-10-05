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
        updatedAt: '2026-09-30T09:00:00+00:00',
        participants: 8,
        meta: { tasks: 6 },
        outcome: { kind: 'estimated', count: 5 },
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

    it('lists each session with its kind, title, meta line and day, and leads to all sessions', () => {
        const { container } = section();
        const lines = container.querySelectorAll(
            '#recent-sessions [data-slot="session-row"]',
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

        const [poker, retro, survey] = Array.from(lines) as HTMLElement[];

        expect(poker.getAttribute('href')).toBe('/poker/game-1');
        expect(poker.getAttribute('data-kind')).toBe('poker');
        expect(poker.textContent).toContain('Sprint 43 refinement');
        expect(poker.textContent).toContain('Planning poker · 6 tasks');
        expect(poker.textContent).toContain('Today');
        expect(retro.textContent).toContain('Retro · Completed · 31 cards');
        expect(retro.textContent).toContain('Sep 18');
        expect(survey.textContent).toContain('Survey · 5 questions');
    });

    it('gives the year of a session last active in another year', () => {
        renderWithProviders(
            <TeamRecentSessions
                rows={[row({ updatedAt: '2025-09-18T10:00:00+00:00' })]}
                allSessionsHref="/sessions"
            />,
        );

        expect(
            document.querySelector('[data-slot="session-row"]')?.textContent,
        ).toContain('Sep 18, 2025');
    });

    it('gives the outcome of an ended session, calls an unpublished survey a draft and offers to join none', () => {
        const { container } = section();
        const [poker, retro, survey] = Array.from(
            container.querySelectorAll('[data-slot="session-row"]'),
        ) as HTMLElement[];

        expect(within(poker).getByText('Ended')).toBeTruthy();
        expect(within(poker).getByText('5 estimated')).toBeTruthy();
        expect(within(retro).getByText('Ended')).toBeTruthy();
        expect(within(retro).getByText('6 actions')).toBeTruthy();
        expect(within(survey).getByText('Draft')).toBeTruthy();
        expect(within(survey).queryByText('Ended')).toBeNull();
        expect(screen.queryByRole('link', { name: /^Join/ })).toBeNull();
    });

    it('draws the sessions as the rows of the Sessions list, in a list and no longer in a table', () => {
        const { container } = section();

        expect(container.querySelector('table')).toBeNull();
        expect(
            container.querySelectorAll(
                '#recent-sessions li [data-slot="session-row"]',
            ),
        ).toHaveLength(3);
    });
});
