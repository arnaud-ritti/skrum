import { describe, expect, it } from 'vitest';
import {
    estimatedPoints,
    seatsFrom,
    showsPokerCursors,
    storyFrom,
    taskPosition,
} from '@/lib/poker/room-adapters';
import type {
    PokerPlayer,
    PokerRound,
    PokerSnapshot,
    PokerTask,
} from '@/lib/poker/types';

function player(id: string, overrides: Partial<PokerPlayer> = {}): PokerPlayer {
    return {
        id,
        name: id.toUpperCase(),
        avatarUrl: `/avatars/${id}.svg`,
        isGuest: false,
        isSpectator: false,
        ...overrides,
    };
}

function round(overrides: Partial<PokerRound> = {}): PokerRound {
    return {
        id: 'round-1',
        number: 1,
        anonymous: false,
        revealedAt: null,
        revealReason: null,
        timerEndsAt: null,
        version: 1,
        votesCount: 0,
        votes: [],
        myVote: null,
        result: null,
        ...overrides,
    };
}

function task(id: string, overrides: Partial<PokerTask> = {}): PokerTask {
    return {
        id,
        title: `Task ${id}`,
        description: null,
        descriptionHtml: '',
        position: 1,
        estimate: null,
        estimatedAt: null,
        roundsCount: 0,
        external: null,
        ...overrides,
    };
}

function snapshot(overrides: Partial<PokerSnapshot> = {}): PokerSnapshot {
    return {
        game: {
            id: 'game-1',
            title: 'Sprint 43 refinement',
            deck: 'fibonacci',
            deckLabel: 'Fibonacci',
            cards: ['1', '2', '3', '5', '8', '?', '☕'],
            isNumeric: true,
            facilitatorPlayerId: 'ada',
            guestAccessEnabled: false,
            guestUrl: null,
            endedAt: null,
            currentTaskId: 't1',
            tasksCount: 1,
            estimatedCount: 0,
            totalPoints: null,
            hasVotes: false,
            autoReveal: false,
            anonymousVotes: false,
            cursorsEnabled: true,
            reactionsEnabled: true,
        },
        me: {
            playerId: 'ada',
            userId: 'user-ada',
            isGuest: false,
            isFacilitator: true,
            isSpectator: false,
            canVote: true,
            canEditTasks: true,
            canTakeControl: false,
            canDelete: true,
            transferCandidates: [],
        },
        players: [player('ada'), player('bob'), player('cleo')],
        tasks: [task('t1')],
        current: { taskId: 't1', round: round() },
        links: { team: '/w/nordlys/teams/atlas' },
        share: {} as PokerSnapshot['share'],
        deliveries: [],
        integrations: null,
        serverTime: '2026-10-02T09:00:00Z',
        ...overrides,
    };
}

describe('seatsFrom', () => {
    it('seats the online players, the viewer marked, with nothing but their state before the reveal', () => {
        const seats = seatsFrom(
            snapshot({
                current: {
                    taskId: 't1',
                    round: round({
                        votes: [{ playerId: 'bob', value: null }],
                        votesCount: 1,
                    }),
                },
            }),
            new Set(['ada', 'bob', 'cleo']),
        );

        expect(seats).toEqual([
            {
                user: {
                    id: 'ada',
                    name: 'ADA',
                    avatarUrl: '/avatars/ada.svg',
                    isMe: true,
                },
                state: 'waiting',
                value: null,
                offline: false,
            },
            {
                user: {
                    id: 'bob',
                    name: 'BOB',
                    avatarUrl: '/avatars/bob.svg',
                    isMe: false,
                },
                state: 'voted',
                value: null,
                offline: false,
            },
            {
                user: {
                    id: 'cleo',
                    name: 'CLEO',
                    avatarUrl: '/avatars/cleo.svg',
                    isMe: false,
                },
                state: 'waiting',
                value: null,
                offline: false,
            },
        ]);
    });

    it('keeps an offline voter at the table and drops an offline player who did not vote', () => {
        const seats = seatsFrom(
            snapshot({
                current: {
                    taskId: 't1',
                    round: round({
                        votes: [{ playerId: 'bob', value: null }],
                        votesCount: 1,
                    }),
                },
            }),
            new Set(['ada']),
        );

        expect(seats.map((seat) => [seat.user.id, seat.state])).toEqual([
            ['ada', 'waiting'],
            ['bob', 'voted'],
        ]);
        expect(seats[1].offline).toBe(true);
    });

    it('never puts a value on a seat before the reveal, the viewer own vote included', () => {
        const seats = seatsFrom(
            snapshot({
                current: {
                    taskId: 't1',
                    round: round({
                        myVote: '5',
                        votes: [{ playerId: 'ada', value: '5' }],
                        votesCount: 1,
                    }),
                },
            }),
            new Set(['ada']),
        );

        expect(seats[0]).toMatchObject({ state: 'voted', value: null });
    });

    it('shows the values once revealed, and keeps them hidden on an anonymous round', () => {
        const votes = [
            { playerId: 'ada', value: '5' },
            { playerId: 'bob', value: '8' },
        ];
        const online = new Set(['ada', 'bob']);
        const named = seatsFrom(
            snapshot({
                current: {
                    taskId: 't1',
                    round: round({
                        revealedAt: '2026-10-02T09:01:00Z',
                        votes,
                    }),
                },
            }),
            online,
        );
        const anonymous = seatsFrom(
            snapshot({
                current: {
                    taskId: 't1',
                    round: round({
                        revealedAt: '2026-10-02T09:01:00Z',
                        anonymous: true,
                        votes,
                    }),
                },
            }),
            online,
        );

        expect(named.map((seat) => seat.value)).toEqual(['5', '8']);
        expect(anonymous.map((seat) => seat.value)).toEqual([null, null]);
        expect(anonymous.map((seat) => seat.state)).toEqual(['voted', 'voted']);
    });

    it('puts an online spectator among the watchers and drops an offline one', () => {
        const seats = seatsFrom(
            snapshot({
                players: [
                    player('ada'),
                    player('casey', { isSpectator: true, isGuest: true }),
                    player('dana', { isSpectator: true }),
                ],
            }),
            new Set(['ada', 'casey']),
        );

        expect(seats.map((seat) => [seat.user.id, seat.state])).toEqual([
            ['ada', 'waiting'],
            ['casey', 'watching'],
        ]);
    });

    it('seats a spectator who voted before a named reveal as a voter, and leaves them a watcher on an anonymous one', () => {
        const players = [player('ada'), player('bob', { isSpectator: true })];
        const votes = [
            { playerId: 'ada', value: '3' },
            { playerId: 'bob', value: '8' },
        ];
        const online = new Set(['ada', 'bob']);
        const named = seatsFrom(
            snapshot({
                players,
                current: {
                    taskId: 't1',
                    round: round({
                        revealedAt: '2026-10-02T09:01:00Z',
                        votes,
                    }),
                },
            }),
            online,
        );
        const anonymous = seatsFrom(
            snapshot({
                players,
                current: {
                    taskId: 't1',
                    round: round({
                        revealedAt: '2026-10-02T09:01:00Z',
                        anonymous: true,
                        votes,
                    }),
                },
            }),
            online,
        );
        const open = seatsFrom(
            snapshot({
                players,
                current: { taskId: 't1', round: round({ votes }) },
            }),
            online,
        );

        expect(named[1]).toMatchObject({ state: 'voted', value: '8' });
        expect(anonymous[1]).toMatchObject({ state: 'watching', value: null });
        expect(open[1]).toMatchObject({ state: 'watching', value: null });
    });

    it('seats nobody without a current round but still lists the watchers', () => {
        const seats = seatsFrom(
            snapshot({
                current: null,
                players: [player('ada'), player('bob', { isSpectator: true })],
            }),
            new Set(['ada', 'bob']),
        );

        expect(seats.map((seat) => seat.state)).toEqual([
            'waiting',
            'watching',
        ]);
    });
});

describe('storyFrom', () => {
    it('takes the title, and the key and link of an imported task', () => {
        expect(storyFrom(task('t1', { title: 'Login page' }))).toEqual({
            title: 'Login page',
        });
        expect(
            storyFrom(
                task('t2', {
                    title: 'Checkout page',
                    external: {
                        source: 'jira',
                        key: 'PROJ-1',
                        url: 'https://acme.atlassian.net/browse/PROJ-1',
                        isManaged: true,
                    },
                }),
            ),
        ).toEqual({
            key: 'PROJ-1',
            title: 'Checkout page',
            url: 'https://acme.atlassian.net/browse/PROJ-1',
        });
    });
});

describe('taskPosition', () => {
    it('counts the place of a task in the list order', () => {
        const tasks = [
            task('a', { position: 3 }),
            task('b', { position: 1 }),
            task('c', { position: 2 }),
        ];

        expect(taskPosition(tasks, 'a')).toBe(3);
        expect(taskPosition(tasks, 'b')).toBe(1);
        expect(taskPosition(tasks, 'missing')).toBeNull();
    });
});

describe('estimatedPoints', () => {
    it('adds the numeric estimates and ignores the others', () => {
        expect(
            estimatedPoints([
                task('a', { estimate: '3' }),
                task('b', { estimate: '8' }),
                task('c', { estimate: null }),
                task('d', { estimate: '?' }),
                task('e', { estimate: '0.5' }),
                task('f', { estimate: '½' }),
            ]),
        ).toBe(12);
    });

    it('is null when no estimate is a number, as on a T-shirt deck', () => {
        expect(
            estimatedPoints([
                task('a', { estimate: 'M' }),
                task('b', { estimate: null }),
            ]),
        ).toBeNull();
    });
});

describe('showsPokerCursors', () => {
    it('shows cursors between rounds only, never on an ended game or when turned off', () => {
        const open = snapshot();
        const revealed = snapshot({
            current: {
                taskId: 't1',
                round: round({ revealedAt: '2026-10-02T09:01:00Z' }),
            },
        });

        expect(showsPokerCursors(open)).toBe(false);
        expect(showsPokerCursors(revealed)).toBe(true);
        expect(showsPokerCursors(snapshot({ current: null }))).toBe(true);
        expect(
            showsPokerCursors({
                ...revealed,
                game: { ...revealed.game, endedAt: '2026-10-02T10:00:00Z' },
            }),
        ).toBe(false);
        expect(
            showsPokerCursors({
                ...revealed,
                game: { ...revealed.game, cursorsEnabled: false },
            }),
        ).toBe(false);
    });
});
