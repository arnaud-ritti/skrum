import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '@/components/retro/board';
import { renderWithProviders } from '@/test/render';
import { boardContext, retroSnapshot } from '@/test/retro-board';

const state = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('@/hooks/use-retro-board', () => ({
    useRetroBoard: () => state.value,
}));

vi.mock('@/hooks/use-game-room', () => ({
    useGameRoom: (snapshot: unknown) => ({
        state: { snapshot, lastEnded: null },
        dispatch: () => undefined,
        apply: () => undefined,
        run: async () => undefined,
        handleError: () => null,
        handleEvent: () => undefined,
        refetch: async () => undefined,
        serverOffset: 0,
        sessionExpired: false,
    }),
}));

vi.mock('@/components/games/game-stage', () => ({
    GameStage: () => <p>Ready to play?</p>,
}));

vi.mock('@/components/games/room-sidebar', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('@/components/games/room-sidebar')
    >()),
    RoomSidebar: () => <p>Players</p>,
}));

const icebreakerRoom = {
    room: { id: 'room-1', game: 'hangman', isHost: true, timerEndsAt: null },
    games: [{ value: 'hangman', label: 'Hangman', available: true }],
    players: [],
    leaderboard: [],
    round: null,
};

function icebreakerSnapshot(icebreaker: unknown = icebreakerRoom) {
    return retroSnapshot({
        retro: {
            phase: 'icebreaker',
            icebreakerEnabled: true,
            phases: [
                'icebreaker',
                'writing',
                'grouping',
                'voting',
                'discussing',
                'completed',
            ],
        },
        icebreaker: icebreaker as never,
    });
}

function given(
    overrides: Record<string, unknown> = {},
    snapshot = retroSnapshot(),
) {
    state.value = {
        ...boardContext(snapshot),
        status: 'active',
        connected: true,
        reconnecting: false,
        ...overrides,
    };

    return renderWithProviders(<Board snapshot={snapshot} />);
}

beforeEach(() => {
    state.value = {};
});

describe('Board', () => {
    it('renders the session shell: one realtime root, one main, the title, the phases, the people', () => {
        const { container } = given();

        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(
            container
                .querySelector('[data-realtime]')
                ?.getAttribute('data-realtime'),
        ).toBe('connected');
        expect(screen.getAllByRole('main')).toHaveLength(1);

        const header = container.querySelector('header') as HTMLElement;

        expect(header.querySelector('h1')?.textContent).toBe('Sprint 42');
        expect(header.querySelector('ol[aria-label="Phases"]')).not.toBeNull();
        expect(
            header.querySelector('[role="group"][aria-label="2 online"]'),
        ).not.toBeNull();
        expect(
            screen.getByRole('toolbar', { name: 'Facilitation tools' }),
        ).toBeTruthy();
    });

    it('is still connecting until the presence channel has answered', () => {
        const { container } = given({ online: [] });

        expect(
            container
                .querySelector('[data-realtime]')
                ?.getAttribute('data-realtime'),
        ).toBe('connecting');
    });

    it('makes the board inert under the expired banner', () => {
        const { container } = given({ sessionExpired: true });

        expect(screen.getByRole('alert').textContent).toContain(
            'Your session has expired.',
        );
        expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
        expect(
            container
                .querySelector('[data-slot="retro-body"]')
                ?.closest('[inert]'),
        ).not.toBeNull();
        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
    });

    it('shows the reconnecting banner of a retro, which never speaks of cards kept locally', () => {
        given({ reconnecting: true });

        const banner = screen.getByRole('status', {
            name: (_name, element) =>
                element.getAttribute('data-variant') === 'banner',
        });

        expect(banner.textContent).toContain('Reconnecting…');
        expect(banner.textContent).toContain(
            'Live updates are paused. What you see may be out of date.',
        );
        expect(screen.queryByText(/kept locally/)).toBeNull();
    });

    it('keeps only the title once the board has ended for this viewer', () => {
        const { container } = given({ status: 'deleted' });

        expect(
            screen.getByText('This retrospective has been deleted.'),
        ).toBeTruthy();
        expect(container.querySelector('ol[aria-label="Phases"]')).toBeNull();
        expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('shows an observer the board read-only, under the line "You are observing this session."', () => {
        given(
            {},
            retroSnapshot({
                retro: { phase: 'writing' },
                columns: [
                    {
                        id: 'start',
                        title: 'Start',
                        description: null,
                        color: 'moss',
                        position: 0,
                    },
                ],
                viewer: { isFacilitator: false, participantId: 'bob' },
                viewerIsObserver: true,
            }),
        );

        expect(
            screen
                .getByText('You are observing this session.')
                .closest('[data-slot="observer-notice"]'),
        ).not.toBeNull();
        expect(screen.queryByText('Add a card')).toBeNull();
        expect(screen.getByText('No card yet.')).toBeTruthy();
    });

    it('shows no observer line to the facilitator, even an observer of the team', () => {
        given({}, retroSnapshot({ viewerIsObserver: true }));

        expect(
            screen.queryByText('You are observing this session.'),
        ).toBeNull();
    });

    it('gives a participant no facilitator bar and no facilitator menu', () => {
        given(
            {},
            retroSnapshot({
                viewer: { isFacilitator: false, participantId: 'bob' },
            }),
        );

        expect(
            screen.queryByRole('toolbar', { name: 'Facilitation tools' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Facilitator menu' }),
        ).toBeNull();
    });

    describe('in the Icebreaker phase', () => {
        it('shows the game in place of the columns, in the one main of the shell', () => {
            const { container } = given({}, icebreakerSnapshot());

            const stage = screen.getByRole('region', {
                name: 'Icebreaker game',
            });

            expect(stage.textContent).toContain('Ready to play?');
            expect(
                within(stage).getByRole('button', { name: 'Choose a game' }),
            ).toBeTruthy();
            expect(screen.getAllByRole('main')).toHaveLength(1);
            expect(
                container
                    .querySelector('[data-slot="retro-body"]')
                    ?.contains(stage),
            ).toBe(true);
            expect(
                container.querySelectorAll('[data-test^="retro-column-"]'),
            ).toHaveLength(0);
            expect(
                screen.queryByRole('button', { name: 'Add column' }),
            ).toBeNull();
        });

        it('keeps the chrome of the board: the Icebreaker step, the timer, the facilitator bar', () => {
            const { container } = given({}, icebreakerSnapshot());
            const header = container.querySelector('header') as HTMLElement;

            expect(
                header.querySelector('[aria-current="step"]')?.textContent,
            ).toContain('Icebreaker');
            expect(
                screen.getAllByRole('button', { name: 'Timer' }),
            ).toHaveLength(1);
            expect(
                header.contains(screen.getByRole('button', { name: 'Timer' })),
            ).toBe(true);
            expect(
                screen.getByRole('toolbar', { name: 'Facilitation tools' }),
            ).toBeTruthy();
        });

        it('leaves the room of the facilitator bar under the game', () => {
            const { container } = given({}, icebreakerSnapshot());

            expect(
                container.querySelector('[data-slot="retro-body"]')?.className,
            ).toContain('pb-32');
        });

        it('waits with a spinner until the game has loaded', () => {
            given({}, icebreakerSnapshot(null));

            expect(
                screen.getByRole('status', { name: 'Loading' }),
            ).toBeTruthy();
            expect(
                screen.queryByRole('region', { name: 'Icebreaker game' }),
            ).toBeNull();
        });
    });

    describe('in the Discussing phase', () => {
        const discussingSnapshot = () =>
            retroSnapshot({
                retro: {
                    phase: 'discussing',
                    highlightedCardId: 'c1',
                    topicSeconds: 300,
                    timerEndsAt: new Date(Date.now() + 252_000).toISOString(),
                },
                cards: [
                    {
                        id: 'c1',
                        columnId: 'col-1',
                        parentCardId: null,
                        position: 0,
                        isMine: false,
                        hidden: false,
                        content: 'Slow CI',
                        gif: null,
                        author: null,
                        groupName: null,
                        discussedAt: null,
                        votes: 2,
                        myVotes: 0,
                        reactions: [],
                        commentCount: 0,
                        comments: [],
                        sentiment: null,
                        category: null,
                    },
                ],
            });

        beforeEach(() => {
            Element.prototype.scrollIntoView = vi.fn();
        });

        it('has the timer of the topic on the stage, and none in the topbar', () => {
            const { container } = given({}, discussingSnapshot());
            const header = container.querySelector('header') as HTMLElement;

            expect(header.querySelector('[data-slot="timer"]')).toBeNull();
            expect(
                screen.getAllByRole('button', { name: 'Timer' }),
            ).toHaveLength(1);
            expect(
                container.querySelector(
                    '[data-slot="retro-topic-stage"] [data-slot="retro-topic-timer"]',
                ),
            ).not.toBeNull();
        });

        it('fills the topics list with the time left', () => {
            const { container } = given({}, discussingSnapshot());

            expect(
                container.querySelector('[data-slot="retro-topic-meta"]')
                    ?.textContent,
            ).toMatch(/^Now · 04:1\d left$/);
            expect(
                container.querySelector('[data-slot="retro-topics-summary"]')
                    ?.textContent,
            ).toBe('5 min per topic · 0 actions so far');
        });

        it('opens the right column on the discussion notes of the topic', () => {
            const { container } = given({}, discussingSnapshot());
            const panels = container.querySelector(
                '[data-slot="retro-discussion-panels"]',
            );

            expect(panels?.firstElementChild?.getAttribute('data-slot')).toBe(
                'retro-topic-notes',
            );
        });
    });

    describe('in the ROTI phase', () => {
        const rotiSnapshot = () =>
            retroSnapshot({
                retro: { phase: 'roti' },
                roti: {
                    myScore: null,
                    respondents: 0,
                    voterIds: [],
                    canVote: true,
                    revealed: false,
                    results: null,
                },
            });

        it('shows the rating and who has voted in place of the columns, and ends the session from the bar', () => {
            const { container } = given({}, rotiSnapshot());

            expect(
                container.querySelector('[data-slot="retro-roti"]'),
            ).not.toBeNull();
            expect(
                screen.getByRole('group', {
                    name: 'Was this time together worth it?',
                }),
            ).toBeTruthy();
            expect(
                screen.getByRole('heading', { name: 'Who has voted' }),
            ).toBeTruthy();
            expect(
                container.querySelector('[data-slot="retro-columns"]'),
            ).toBeNull();
            expect(
                within(
                    screen.getByRole('toolbar', { name: 'Facilitation tools' }),
                ).getByRole('button', { name: 'End session' }),
            ).toBeTruthy();
            expect(screen.queryByText('Suggest group names')).toBeNull();
        });

        it('puts "Nudge the last" and "Reveal ROTI" in the facilitator bar', () => {
            given({}, rotiSnapshot());
            const bar = screen.getByRole('toolbar', {
                name: 'Facilitation tools',
            });

            expect(
                within(bar).getByRole('button', { name: 'Nudge the last one' }),
            ).toBeTruthy();
            expect(
                within(bar).getByRole('button', { name: 'Reveal ROTI' }),
            ).toBeTruthy();
        });
    });

    describe('once completed', () => {
        const completedSnapshot = () =>
            retroSnapshot({
                retro: {
                    phase: 'completed',
                    completedAt: '2026-10-02T10:00:00Z',
                },
                results: {
                    participants: [],
                    health: null,
                    healthTrend: null,
                    surveys: [],
                    games: null,
                    roti: { distribution: [], average: null, respondents: 0 },
                    summary: null,
                    deliveries: [],
                    emailRecipients: null,
                    stats: {
                        votesCast: 0,
                        votesAvailable: 5,
                        participation: { participants: 1, expected: 1 },
                        durationSeconds: null,
                    },
                },
            });
        const confetti = () =>
            document.querySelector('[data-slot="session-confetti"]');

        it('shows the session end in place of the columns, without a facilitator bar and without confetti on a visit', () => {
            const { container } = given({}, completedSnapshot());

            expect(
                container.querySelector('[data-slot="retro-session-end"]'),
            ).not.toBeNull();
            expect(
                screen
                    .getByRole('tab', { name: 'Results' })
                    .getAttribute('aria-selected'),
            ).toBe('true');
            expect(
                container.querySelector('[data-slot="retro-columns"]'),
            ).toBeNull();
            expect(
                screen.queryByRole('toolbar', { name: 'Facilitation tools' }),
            ).toBeNull();
            expect(confetti()).toBeNull();
        });

        it('throws the confetti for who sees the session end, and not again after a reopen', () => {
            const roti = retroSnapshot({ retro: { phase: 'roti' } });
            const view = given({}, roti);
            const turn = (snapshot: ReturnType<typeof retroSnapshot>) => {
                state.value = { ...state.value, board: snapshot };
                view.rerender(<Board snapshot={snapshot} />);
            };

            expect(confetti()).toBeNull();

            turn(completedSnapshot());

            expect(confetti()).not.toBeNull();

            turn(roti);

            expect(confetti()).toBeNull();
            expect(
                view.container.querySelector('[data-slot="retro-roti"]'),
            ).not.toBeNull();
        });
    });
});
