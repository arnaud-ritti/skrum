import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionsPage } from '@/components/teams/sessions-page';
import type { SessionsPageProps } from '@/components/teams/sessions-page';
import { RetroRequestError } from '@/lib/retro/api';
import type { TeamSession } from '@/lib/teams/sessions';
import { renderWithProviders } from '@/test/render';
import type { NewSessionOptions } from '@/types';

const mocks = vi.hoisted(() => ({
    reload: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
    toastError: vi.fn(),
    props: {
        translations: {} as Record<string, string>,
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
            post: mocks.post,
            reload: mocks.reload,
            replace: vi.fn(),
            on: vi.fn(() => () => {}),
        },
    };
});

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: mocks.request,
}));

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

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
        state: 'finished',
        updatedAt: '2026-10-02T10:00:00+00:00',
        isDraft: false,
        phase: 'Completed',
        people: 9,
        tasks: null,
        facilitator: null,
        answers: null,
        game: null,
        sprint: null,
        roti: null,
        actions: null,
        points: null,
        canDelete: false,
        canDuplicate: false,
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

const liveRetro = session({
    id: 'r9',
    title: 'Sprint 44 retro',
    url: '/retros/r9',
    state: 'live',
    phase: 'Writing',
});

const board = session({
    kind: 'whiteboard',
    id: 'w1',
    title: 'Q4 architecture',
    url: '/whiteboards/w1',
    phase: null,
    people: null,
    facilitator: 'Inès',
    canDelete: true,
});

const poll = session({
    kind: 'survey',
    id: 's1',
    title: 'Team health',
    url: '/surveys/s1',
    phase: null,
    people: null,
    answers: 7,
    canDelete: true,
    canDuplicate: true,
});

function pageProps(
    overrides: Partial<SessionsPageProps> = {},
): SessionsPageProps {
    return {
        ...options,
        workspace: { id: 'w', name: 'Nordlys', slug: 'nordlys' },
        team: { id: 'team-1', name: 'Atlas' },
        kind: null,
        q: null,
        live: [],
        sessions: [session(), poker],
        counts: {
            all: 2,
            retro: 1,
            poker: 1,
            whiteboard: 0,
            survey: 0,
            icebreaker: 0,
        },
        total: 2,
        nextCursor: null,
        hasSprints: false,
        ...overrides,
    };
}

function rows(root: ParentNode = document): HTMLElement[] {
    return Array.from(
        root.querySelectorAll<HTMLElement>('[data-slot="session-row"]'),
    );
}

function rowOf(title: string): HTMLElement {
    return screen.getByText(title).closest('[data-slot="card"]') as HTMLElement;
}

function chips() {
    return within(screen.getByRole('navigation', { name: 'Kinds' }));
}

beforeEach(() => {
    mocks.reload.mockClear();
    mocks.post.mockClear();
    mocks.request.mockReset();
    mocks.toastError.mockClear();
});

afterEach(() => {
    window.history.replaceState(null, '', '/');
});

describe('SessionsPage', () => {
    it('lists a row per session, with its meta line and its link', () => {
        renderWithProviders(<SessionsPage {...pageProps()} />);

        const retro = screen.getByRole('link', {
            name: 'Sprint 42 retro, Retro · 9 people, Oct 2, 2026, Completed',
        });

        expect(retro.getAttribute('href')).toBe('/retros/r1');
        expect(
            screen
                .getByRole('link', {
                    name: 'Sprint 43 refinement, Planning poker · 12 tasks, Oct 2, 2026, Ended',
                })
                .getAttribute('data-kind'),
        ).toBe('poker');
        expect(rows()).toHaveLength(2);
    });

    it('lists live sessions under Live now with Join, and the rest below', () => {
        renderWithProviders(
            <SessionsPage {...pageProps({ live: [liveRetro] })} />,
        );

        const live = screen.getByRole('region', { name: 'Live now' });

        expect(rows(live).map((row) => row.getAttribute('href'))).toEqual([
            '/retros/r9',
        ]);
        expect(
            within(live)
                .getByRole('link', { name: 'Join' })
                .getAttribute('href'),
        ).toBe('/retros/r9');
        expect(rowOf('Sprint 44 retro').textContent).toContain(
            'Retro · Writing · 9 people',
        );
        expect(rows().map((row) => row.getAttribute('href'))).toEqual([
            '/retros/r9',
            '/retros/r1',
            '/poker/p1',
        ]);
        expect(
            within(rowOf('Sprint 42 retro')).queryByRole('link', {
                name: 'Join',
            }),
        ).toBeNull();
    });

    it('has no Live now block when no session is live', () => {
        renderWithProviders(<SessionsPage {...pageProps()} />);

        expect(screen.queryByRole('region', { name: 'Live now' })).toBeNull();
    });

    it('shows a session once when it is live and still among the loaded rows', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    live: [liveRetro],
                    sessions: [
                        session(),
                        { ...liveRetro, state: 'upcoming' },
                        poker,
                    ],
                })}
            />,
        );

        expect(rows().map((row) => row.getAttribute('href'))).toEqual([
            '/retros/r9',
            '/retros/r1',
            '/poker/p1',
        ]);
        expect(
            rows(screen.getByRole('region', { name: 'Live now' })),
        ).toHaveLength(1);
    });

    it('counts what is left to load without the row that went live', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    live: [liveRetro],
                    sessions: [
                        session(),
                        { ...liveRetro, state: 'upcoming' },
                        poker,
                    ],
                    total: 5,
                    nextCursor: 'cursor-1',
                })}
            />,
        );

        expect(
            screen.getByRole('button', { name: /Load more/ }).textContent,
        ).toContain('3 more');
    });

    it('groups by sprint, with Outside a sprint for a row without one', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    hasSprints: true,
                    sessions: [
                        session({
                            sprint: {
                                number: 7,
                                startsOn: '2026-09-28',
                                endsOn: '2026-10-11',
                            },
                        }),
                        poker,
                    ],
                })}
            />,
        );

        expect(
            rows(
                screen.getByRole('region', {
                    name: 'Sprint 7 · Sep 28 → Oct 11',
                }),
            ).map((row) => row.getAttribute('href')),
        ).toEqual(['/retros/r1']);
        expect(
            rows(screen.getByRole('region', { name: 'Outside a sprint' })).map(
                (row) => row.getAttribute('href'),
            ),
        ).toEqual(['/poker/p1']);
    });

    it('groups by month for a team without sprints', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    sessions: [
                        session(),
                        { ...poker, updatedAt: '2026-09-12T10:00:00+00:00' },
                    ],
                })}
            />,
        );

        expect(
            rows(screen.getByRole('region', { name: 'October 2026' })),
        ).toHaveLength(1);
        expect(
            rows(screen.getByRole('region', { name: 'September 2026' })).map(
                (row) => row.getAttribute('href'),
            ),
        ).toEqual(['/poker/p1']);
        expect(screen.queryByText('Outside a sprint')).toBeNull();
    });

    it('shows each chip with its count and marks the active one', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({ kind: 'poker', sessions: [poker], total: 1 })}
            />,
        );

        expect(
            chips()
                .getAllByRole('link')
                .map((chip) => chip.textContent),
        ).toEqual([
            'All2',
            'Retro1',
            'Planning poker1',
            'Whiteboard0',
            'Poll0',
            'Icebreaker0',
        ]);

        const active = chips().getByRole('link', { name: /Planning poker/ });

        expect(active.getAttribute('aria-current')).toBe('page');
        expect(active.getAttribute('href')).toBe(
            '/w/nordlys/teams/team-1/sessions?kind=poker',
        );
        expect(
            chips()
                .getByRole('link', { name: /All/ })
                .getAttribute('aria-current'),
        ).toBeNull();
        expect(
            chips().getByRole('link', { name: /All/ }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/sessions');
    });

    it('marks All when no kind is chosen', () => {
        renderWithProviders(<SessionsPage {...pageProps()} />);

        expect(
            chips()
                .getByRole('link', { name: /All/ })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('keeps the search when a chip is chosen', () => {
        renderWithProviders(<SessionsPage {...pageProps({ q: 'sprint' })} />);

        expect(
            chips().getByRole('link', { name: /Retro/ }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/sessions?kind=retro&q=sprint');
        expect(
            chips().getByRole('link', { name: /All/ }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/sessions?q=sprint');
    });

    it('shows Not started and Draft as badges', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    sessions: [
                        session({ state: 'upcoming', phase: 'Writing' }),
                        { ...poll, state: 'upcoming', isDraft: true },
                    ],
                })}
            />,
        );

        expect(
            within(rowOf('Sprint 42 retro'))
                .getByText('Not started')
                .closest('[data-slot="badge"]'),
        ).toBeTruthy();
        expect(
            within(rowOf('Team health'))
                .getByText('Draft')
                .closest('[data-slot="badge"]'),
        ).toBeTruthy();
        expect(screen.queryByText('Ended')).toBeNull();
    });

    it('shows the outcome of each kind', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    sessions: [
                        session({ roti: 4, actions: 2 }),
                        { ...poker, points: 34 },
                        poll,
                        session({
                            kind: 'icebreaker',
                            id: 'i1',
                            title: 'Friday warm-up',
                            url: '/games/i1',
                            phase: null,
                            people: 5,
                            game: 'Hangman',
                        }),
                        board,
                    ],
                    total: 5,
                })}
            />,
        );

        expect(rowOf('Sprint 42 retro').textContent).toContain(
            'ROTI 4.0 · 2 actions',
        );
        expect(
            rowOf('Sprint 42 retro')
                .querySelector('[data-slot="roti-value"]')
                ?.getAttribute('data-step'),
        ).toBe('4');
        expect(
            rowOf('Sprint 42 retro')
                .querySelector('[data-slot="session-row"]')
                ?.getAttribute('aria-label'),
        ).toContain('ROTI 4.0 · 2 actions');
        expect(rowOf('Sprint 43 refinement').textContent).toContain('34 pts');
        expect(rowOf('Team health').textContent).toContain('7 answers');
        expect(rowOf('Friday warm-up').textContent).toContain('5 players');
        expect(
            rowOf('Q4 architecture').querySelector(
                '[data-slot="session-row-outcome"]',
            ),
        ).toBeNull();
    });

    it('shows the date of a row that is not live, and Now on a live one', () => {
        renderWithProviders(
            <SessionsPage {...pageProps({ live: [liveRetro] })} />,
        );

        expect(rowOf('Sprint 42 retro').textContent).toContain('Oct 2, 2026');
        expect(rowOf('Sprint 44 retro').textContent).toContain('Now');
        expect(rowOf('Sprint 44 retro').textContent).toContain('Live');
        expect(rowOf('Sprint 44 retro').textContent).not.toContain('2026');
    });

    it('offers Delete on a board the viewer may delete, and no menu otherwise', async () => {
        const user = userEvent.setup();

        mocks.request.mockResolvedValue(undefined);
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    sessions: [
                        board,
                        {
                            ...board,
                            id: 'w2',
                            title: 'Roadmap',
                            canDelete: false,
                        },
                    ],
                })}
            />,
        );

        expect(
            within(rowOf('Roadmap')).queryByRole('button', {
                name: 'More actions',
            }),
        ).toBeNull();

        await user.click(
            within(rowOf('Q4 architecture')).getByRole('button', {
                name: 'More actions',
            }),
        );

        expect(
            screen.queryByRole('menuitem', { name: 'Duplicate' }),
        ).toBeNull();

        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog', {
            name: 'Delete this board?',
        });

        expect(
            within(dialog).getByText(
                'Everything on it is removed for everyone.',
            ),
        ).toBeTruthy();
        expect(mocks.request).not.toHaveBeenCalled();

        await user.click(
            within(dialog).getByRole('button', { name: 'Delete this board' }),
        );

        expect(mocks.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/whiteboards/w1',
                method: 'delete',
            }),
        );
        expect(mocks.reload).toHaveBeenCalledWith({
            only: ['live', 'sessions', 'counts', 'total', 'nextCursor'],
            reset: ['sessions'],
        });
    });

    it('deletes a survey after asking, and duplicates one', async () => {
        const user = userEvent.setup();

        mocks.request.mockResolvedValue(undefined);
        renderWithProviders(
            <SessionsPage {...pageProps({ sessions: [poll], total: 1 })} />,
        );

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

        expect(mocks.post).toHaveBeenCalledWith(
            '/surveys/s1/duplicate',
            {},
            { preserveScroll: true },
        );

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const dialog = await screen.findByRole('alertdialog', {
            name: 'Delete this survey?',
        });

        expect(
            within(dialog).getByText(
                'Its questions and answers are deleted too.',
            ),
        ).toBeTruthy();

        await user.click(
            within(dialog).getByRole('button', { name: 'Delete' }),
        );

        expect(mocks.request).toHaveBeenCalledWith(
            expect.objectContaining({ url: '/surveys/s1', method: 'delete' }),
        );
        expect(mocks.reload).toHaveBeenCalledWith(
            expect.objectContaining({ reset: ['sessions'] }),
        );
    });

    it('keeps the dialog open and says why when the deletion is refused', async () => {
        const user = userEvent.setup();

        mocks.request.mockRejectedValue(
            new RetroRequestError(403, 'This action is unauthorized.'),
        );
        renderWithProviders(
            <SessionsPage {...pageProps({ sessions: [board], total: 1 })} />,
        );

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
        await user.click(
            within(await screen.findByRole('alertdialog')).getByRole('button', {
                name: 'Delete this board',
            }),
        );

        expect(mocks.toastError).toHaveBeenCalledWith(
            'This action is unauthorized.',
        );
        expect(mocks.reload).not.toHaveBeenCalled();
        expect(screen.getByRole('alertdialog')).toBeTruthy();
    });

    it('says the session is already gone and reloads the list', async () => {
        const user = userEvent.setup();

        mocks.request.mockRejectedValue(
            new RetroRequestError(404, 'This board no longer exists.'),
        );
        renderWithProviders(
            <SessionsPage {...pageProps({ sessions: [board], total: 1 })} />,
        );

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
        await user.click(
            within(await screen.findByRole('alertdialog')).getByRole('button', {
                name: 'Delete this board',
            }),
        );

        expect(mocks.toastError).toHaveBeenCalledWith(
            'This board no longer exists.',
        );
        expect(mocks.reload).toHaveBeenCalledWith(
            expect.objectContaining({ reset: ['sessions'] }),
        );
    });

    it('shows the links of the chosen kind only', () => {
        const all = renderWithProviders(<SessionsPage {...pageProps()} />);

        for (const name of [
            'Estimation history',
            'Saved decks',
            'Whiteboard templates',
            'Leaderboard',
        ]) {
            expect(screen.queryByText(name)).toBeNull();
        }

        all.unmount();

        const pokerPage = renderWithProviders(
            <SessionsPage {...pageProps({ kind: 'poker' })} />,
        );

        expect(
            screen
                .getByRole('link', { name: 'Estimation history' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/estimates');
        expect(
            screen
                .getByRole('link', { name: 'Saved decks' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/poker-decks');
        expect(screen.queryByText('Leaderboard')).toBeNull();
        expect(screen.queryByText('Whiteboard templates')).toBeNull();

        pokerPage.unmount();

        const gamesPage = renderWithProviders(
            <SessionsPage {...pageProps({ kind: 'icebreaker' })} />,
        );

        expect(
            screen
                .getByRole('link', { name: 'Leaderboard' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/games');
        expect(screen.queryByText('Saved decks')).toBeNull();

        gamesPage.unmount();

        renderWithProviders(
            <SessionsPage {...pageProps({ kind: 'whiteboard' })} />,
        );

        expect(
            screen.getByRole('button', { name: 'Whiteboard templates' }),
        ).toBeTruthy();
        expect(screen.queryByText('Estimation history')).toBeNull();
    });

    it('asks for the whiteboard templates when their dialog opens, then lists them', () => {
        const { rerender } = renderWithProviders(
            <SessionsPage {...pageProps({ kind: 'whiteboard' })} />,
        );

        expect(mocks.reload).not.toHaveBeenCalled();

        fireEvent.click(
            screen.getByRole('button', { name: 'Whiteboard templates' }),
        );

        expect(mocks.reload).toHaveBeenCalledWith(
            expect.objectContaining({ only: ['whiteboardTemplates'] }),
        );
        expect(screen.queryByRole('dialog')).toBeNull();

        rerender(
            <SessionsPage
                {...pageProps({
                    kind: 'whiteboard',
                    whiteboardTemplates: [
                        {
                            id: 't1',
                            name: 'Story map',
                            description: null,
                            canManage: false,
                        },
                    ],
                })}
            />,
        );

        expect(
            within(
                screen.getByRole('dialog', { name: 'Whiteboard templates' }),
            ).getByText('Story map'),
        ).toBeTruthy();
    });

    it('asks for the next page with the kind and the search', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    kind: 'retro',
                    q: 'sprint',
                    total: 3,
                    nextCursor: 'cursor-1',
                })}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /Load more/ }));

        expect(mocks.reload).toHaveBeenCalledWith(
            expect.objectContaining({
                only: ['live', 'sessions', 'total', 'nextCursor'],
                data: { kind: 'retro', before: 'cursor-1', q: 'sprint' },
                preserveUrl: true,
            }),
        );
    });

    it('asks for the next page with the cursor and shows the rows the server merged, the first new one focused', () => {
        const { rerender } = renderWithProviders(
            <SessionsPage
                {...pageProps({ total: 3, nextCursor: 'cursor-1' })}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /Load more/ }));

        expect(mocks.reload).toHaveBeenCalledWith(
            expect.objectContaining({ data: { before: 'cursor-1' } }),
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
                    sessions: [session(), poker, third],
                })}
            />,
        );

        expect(rows().map((row) => row.getAttribute('href'))).toEqual([
            '/retros/r1',
            '/poker/p1',
            '/retros/r3',
        ]);
        expect(document.activeElement?.getAttribute('href')).toBe('/retros/r3');
    });

    it('says when nothing matches the search and offers to clear it', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    kind: 'poker',
                    q: 'zebra',
                    sessions: [],
                    total: 0,
                })}
            />,
        );

        expect(screen.getByText('No session matches “zebra”.')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Clear the search' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/sessions?kind=poker');
    });

    it('ends the list with one session in the singular', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({ sessions: [session()], total: 1 })}
            />,
        );

        expect(
            screen.getByText("You're all caught up · 1 session"),
        ).toBeTruthy();
    });

    it('ends the list with the total once there is no next page, the live sessions counted', () => {
        renderWithProviders(
            <SessionsPage {...pageProps({ live: [liveRetro] })} />,
        );

        expect(screen.queryByRole('button', { name: /Load more/ })).toBeNull();
        expect(
            screen.getByText("You're all caught up · 3 sessions"),
        ).toBeTruthy();
    });

    it('shows the empty state of a team without any session', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({
                    sessions: [],
                    total: 0,
                    counts: {
                        ...pageProps().counts,
                        all: 0,
                        retro: 0,
                        poker: 0,
                    },
                })}
            />,
        );

        const empty = screen
            .getByRole('heading', { name: 'No session yet' })
            .closest('section') as HTMLElement;

        expect(
            within(empty).getByRole('button', { name: 'New session' }),
        ).toBeTruthy();
    });

    it.each([
        ['retro', 'No retro yet'],
        ['poker', 'No planning poker yet'],
        ['whiteboard', 'No whiteboard yet'],
        ['survey', 'No poll yet'],
        ['icebreaker', 'No icebreaker yet'],
    ] as const)('shows the empty state of the %s chip', (kind, title) => {
        renderWithProviders(
            <SessionsPage {...pageProps({ kind, sessions: [], total: 0 })} />,
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
                {...pageProps({
                    kind: 'retro',
                    sessions: [],
                    total: 0,
                    ...nothingOffered,
                })}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'No retro yet' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'New session' }),
        ).toBeNull();
    });

    it('opens the New session dialog from the empty state', () => {
        renderWithProviders(
            <SessionsPage
                {...pageProps({ kind: 'retro', sessions: [], total: 0 })}
            />,
        );

        const empty = screen
            .getByRole('heading', { name: 'No retro yet' })
            .closest('section') as HTMLElement;

        fireEvent.click(
            within(empty).getByRole('button', { name: 'New session' }),
        );

        expect(
            screen.getByRole('dialog', { name: 'New session' }),
        ).toBeTruthy();
    });
});
