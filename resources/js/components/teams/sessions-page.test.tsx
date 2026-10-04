import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionsPage } from '@/components/teams/sessions-page';
import type { SessionsPageProps } from '@/components/teams/sessions-page';
import type { TeamSession } from '@/lib/teams/sessions';
import { renderWithProviders } from '@/test/render';
import type { NewSessionOptions } from '@/types';

const mocks = vi.hoisted(() => ({
    reload: vi.fn(),
    props: {
        translations: {
            'Upcoming sessions': 'Upcoming',
            'Live sessions': 'Live',
            'Finished sessions': 'Finished',
        } as Record<string, string>,
        locale: 'en',
        errors: {} as Record<string, string>,
        currentWorkspace: { role: 'member' },
        auth: { user: { id: 'me' } },
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        router: {
            post: vi.fn(),
            reload: mocks.reload,
            replace: vi.fn(),
            on: vi.fn(() => () => {}),
        },
    };
});

const options: NewSessionOptions = {
    templateCategories: [],
    topTemplates: [],
    canSaveTemplate: false,
    canCreateRetro: true,
    icebreakerGames: [],
    gameOptions: [],
    canCreateGameRoom: true,
    roomLimit: 20,
    pokerDecks: [],
    defaultPokerDeck: { deck: null, savedDeckId: null },
    pokerDeckOptions: [],
    canCreatePokerGame: true,
    pokerSources: [],
    canCreateWhiteboard: true,
    surveys: [],
    canCreateSurvey: true,
    surveyTemplates: [],
    currentSprintNumber: null,
    defaultRetroTemplate: null,
    retroFacilitators: [],
    suggestedFacilitatorId: null,
    facilitatorRotation: false,
};

const nothingOffered: Partial<NewSessionOptions> = {
    canCreateRetro: false,
    canCreatePokerGame: false,
    canCreateWhiteboard: false,
    canCreateSurvey: false,
    canCreateGameRoom: false,
};

function session(overrides: Partial<TeamSession> = {}): TeamSession {
    return {
        kind: 'retro',
        id: 'r1',
        title: 'Sprint 42 retro',
        url: '/retros/r1',
        state: 'live',
        updatedAt: '2026-10-02T10:00:00+00:00',
        isDraft: false,
        phase: 'Writing',
        people: 9,
        tasks: null,
        facilitator: null,
        answers: null,
        game: null,
        ...overrides,
    };
}

const poker = session({
    kind: 'poker',
    id: 'p1',
    title: 'Sprint 43 refinement',
    url: '/poker/p1',
    phase: null,
    people: null,
    tasks: 12,
});

function pageProps(
    overrides: Partial<SessionsPageProps> = {},
): SessionsPageProps {
    return {
        ...options,
        workspace: { id: 'w', name: 'Nordlys', slug: 'nordlys' },
        team: { id: 'team-1', name: 'Atlas' },
        tab: 'live',
        sessions: [session(), poker],
        total: 2,
        nextCursor: null,
        ...overrides,
    };
}

function rows(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>('[data-slot="session-row"]'),
    );
}

beforeEach(() => {
    mocks.reload.mockClear();
});

afterEach(() => {
    window.history.replaceState(null, '', '/');
});

describe('SessionsPage', () => {
    it('lists a row per session, with its meta line and its link', () => {
        renderWithProviders(<SessionsPage {...pageProps()} />);

        const retro = screen.getByRole('link', {
            name: 'Sprint 42 retro, Retro · Writing · 9 people',
        });

        expect(retro.getAttribute('href')).toBe('/retros/r1');
        expect(
            screen
                .getByRole('link', {
                    name: 'Sprint 43 refinement, Planning poker · 12 tasks',
                })
                .getAttribute('data-kind'),
        ).toBe('poker');
        expect(rows()).toHaveLength(2);
    });

    it('marks the tab of the address as the current page', () => {
        renderWithProviders(
            <SessionsPage {...pageProps({ tab: 'finished' })} />,
        );

        const tabs = within(
            screen.getByRole('navigation', { name: 'Session tabs' }),
        );
        const finished = tabs.getByRole('link', { name: 'Finished' });

        expect(finished.getAttribute('aria-current')).toBe('page');
        expect(finished.getAttribute('href')).toContain('tab=finished');
        expect(
            tabs
                .getByRole('link', { name: 'Live' })
                .getAttribute('aria-current'),
        ).toBeNull();
        expect(
            tabs.getByRole('link', { name: 'Upcoming' }).getAttribute('href'),
        ).toContain('tab=upcoming');
    });

    it('asks for the next page with the cursor and appends it without duplicates', () => {
        const { rerender } = renderWithProviders(
            <SessionsPage
                {...pageProps({ total: 3, nextCursor: 'cursor-1' })}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /Load more/ }));

        expect(mocks.reload).toHaveBeenCalledWith(
            expect.objectContaining({
                only: ['sessions', 'nextCursor'],
                data: { tab: 'live', before: 'cursor-1' },
                preserveUrl: true,
            }),
        );

        const third = session({
            id: 'r3',
            title: 'Third retro',
            url: '/retros/r3',
        });

        rerender(
            <SessionsPage
                {...pageProps({
                    total: 3,
                    nextCursor: null,
                    sessions: [poker, third],
                })}
            />,
        );

        expect(rows().map((row) => row.getAttribute('href'))).toEqual([
            '/retros/r1',
            '/poker/p1',
            '/retros/r3',
        ]);
    });

    it('ends the list with the total once there is no next page', () => {
        renderWithProviders(<SessionsPage {...pageProps()} />);

        expect(screen.queryByRole('button', { name: /Load more/ })).toBeNull();
        expect(
            screen.getByText("You're all caught up · 2 sessions"),
        ).toBeTruthy();
    });

    it.each([
        ['upcoming', 'No upcoming session'],
        ['live', 'No live session right now'],
        ['finished', 'No finished session yet'],
    ] as const)('shows the empty state of the %s tab', (tab, title) => {
        renderWithProviders(
            <SessionsPage {...pageProps({ tab, sessions: [], total: 0 })} />,
        );

        const empty = screen
            .getByRole('heading', { name: title })
            .closest('section') as HTMLElement;

        expect(
            within(empty).getByRole('button', { name: 'New session' }),
        ).toBeTruthy();
    });

    it('offers no "New session" in the empty state when no form is offered', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({ sessions: [], total: 0, ...nothingOffered })}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'No live session right now' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'New session' }),
        ).toBeNull();
    });

    it('opens the New session dialog from the empty state', () => {
        renderWithProviders(
            <SessionsPage {...pageProps({ sessions: [], total: 0 })} />,
        );

        const empty = screen
            .getByRole('heading', { name: 'No live session right now' })
            .closest('section') as HTMLElement;

        fireEvent.click(
            within(empty).getByRole('button', { name: 'New session' }),
        );

        expect(
            screen.getByRole('dialog', { name: 'New session' }),
        ).toBeTruthy();
    });

    it('carries the Draft badge on a draft poll', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    tab: 'upcoming',
                    sessions: [
                        session({
                            kind: 'survey',
                            id: 's1',
                            title: 'Team health',
                            url: '/surveys/s1',
                            state: 'upcoming',
                            isDraft: true,
                            phase: null,
                            people: null,
                            answers: 0,
                        }),
                    ],
                    total: 1,
                })}
            />,
        );

        expect(rows()[0].textContent).toContain('Draft');
    });

    it('ends the meta line with the date on the Upcoming and Finished tabs only', () => {
        const { unmount } = renderWithProviders(
            <SessionsPage {...pageProps()} />,
        );

        expect(rows()[0].textContent).not.toContain('2026');

        unmount();

        for (const tab of ['upcoming', 'finished'] as const) {
            const view = renderWithProviders(
                <SessionsPage
                    {...pageProps({
                        tab,
                        sessions: [session({ state: tab })],
                        total: 1,
                    })}
                />,
            );

            expect(rows()[0].textContent).toContain(
                'Retro · Writing · 9 people · Oct 2, 2026',
            );

            view.unmount();
        }
    });
});
