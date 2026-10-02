import { describe, expect, it } from 'vitest';
import {
    cardEngagement,
    cardVoting,
    groupingProgress,
    toCardProps,
    toColumnProps,
    toGroupProps,
    toHealthStatements,
    votingProgress,
    writingProgress,
} from '@/lib/retro/adapters';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { retroSnapshot } from '@/test/retro-board';

const columns: BoardColumn[] = [
    {
        id: 'start',
        title: 'Start',
        description: null,
        color: 'moss',
        position: 0,
    },
    {
        id: 'stop',
        title: 'Stop',
        description: 'What slows us down',
        color: 'coral',
        position: 1,
    },
];

function card(overrides: Partial<BoardCard> = {}): BoardCard {
    return {
        id: 'c1',
        columnId: 'start',
        parentCardId: null,
        position: 0,
        isMine: true,
        hidden: false,
        content: 'Ship smaller pull requests',
        gif: null,
        author: { id: 'me', name: 'Alice Martin' },
        groupName: null,
        votes: null,
        myVotes: 0,
        reactions: [],
        commentCount: 0,
        comments: [],
        sentiment: null,
        category: null,
        ...overrides,
    };
}

describe('toCardProps', () => {
    it('maps the text, the colour of the column and the author with their avatar', () => {
        const mine = card({ columnId: 'stop' });
        const props = toCardProps(
            mine,
            retroSnapshot({ columns, cards: [mine] }),
        );

        expect(props).toMatchObject({
            id: 'c1',
            text: 'Ship smaller pull requests',
            color: 'coral',
            masked: false,
            isMine: true,
            author: { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg' },
            maxLength: 1000,
        });
    });

    it('has no author on an anonymous retro, and masks a card that is still hidden', () => {
        const theirs = card({
            isMine: false,
            hidden: true,
            content: null,
            author: null,
        });
        const props = toCardProps(
            theirs,
            retroSnapshot({ columns, cards: [theirs] }),
        );

        expect(props.author).toBeNull();
        expect(props.masked).toBe(true);
        expect(props.text).toBeNull();
        expect(props.canEdit).toBe(false);
    });

    it('carries the GIF and the insight', () => {
        const withGif = card({
            content: null,
            gif: {
                id: 'party1',
                previewUrl: '/gifs/party1/preview',
                url: '/gifs/party1',
            },
            sentiment: 'positive',
            category: 'Delivery',
        });
        const props = toCardProps(
            withGif,
            retroSnapshot({ columns, cards: [withGif] }),
        );

        expect(props.gif).toEqual({
            previewUrl: '/gifs/party1/preview',
            url: '/gifs/party1',
        });
        expect(props.insight).toEqual({
            sentiment: 'positive',
            category: 'Delivery',
        });
    });

    it('lets the author edit in Writing and Grouping only, and never on a locked board', () => {
        const mine = card();
        const canEdit = (retro: object, target = mine) =>
            toCardProps(
                target,
                retroSnapshot({ columns, cards: [target], retro }),
            ).canEdit;

        expect(canEdit({ phase: 'writing' })).toBe(true);
        expect(canEdit({ phase: 'grouping' })).toBe(true);
        expect(canEdit({ phase: 'voting' })).toBe(false);
        expect(canEdit({ phase: 'writing', isLocked: true })).toBe(false);
        expect(canEdit({ phase: 'writing' }, card({ isMine: false }))).toBe(
            false,
        );
    });

    it('marks the card the facilitator highlights', () => {
        const mine = card();
        const board = retroSnapshot({
            columns,
            cards: [mine],
            retro: { phase: 'discussing', highlightedCardId: 'c1' },
        });

        expect(toCardProps(mine, board).focused).toBe(true);
    });
});

describe('toColumnProps', () => {
    const cards = [
        card({ id: 'c1' }),
        card({ id: 'c2', position: 1 }),
        card({ id: 'c3', parentCardId: 'c2' }),
    ];

    it('counts every card, grouped ones included, and knows its neighbours', () => {
        const board = retroSnapshot({ columns, cards });

        expect(toColumnProps(columns[0], board)).toMatchObject({
            id: 'start',
            title: 'Start',
            color: 'moss',
            description: null,
            count: 3,
            canAdd: true,
            canMoveLeft: false,
            canMoveRight: true,
            hasCards: true,
        });
        expect(toColumnProps(columns[1], board)).toMatchObject({
            description: 'What slows us down',
            count: 0,
            canMoveLeft: true,
            canMoveRight: false,
            hasCards: false,
        });
    });

    it('takes cards in Writing only, and not on a locked board', () => {
        const canAdd = (retro: object) =>
            toColumnProps(columns[0], retroSnapshot({ columns, cards, retro }))
                .canAdd;

        expect(canAdd({ phase: 'writing' })).toBe(true);
        expect(canAdd({ phase: 'grouping' })).toBe(false);
        expect(canAdd({ phase: 'writing', isLocked: true })).toBe(false);
    });

    it('lets the facilitator change the columns until Writing ends', () => {
        const canManage = (retro: object, viewer: object = {}) =>
            toColumnProps(
                columns[0],
                retroSnapshot({ columns, cards, retro, viewer }),
            ).canManage;

        expect(canManage({ phase: 'health_check' })).toBe(true);
        expect(canManage({ phase: 'icebreaker' })).toBe(true);
        expect(canManage({ phase: 'writing' })).toBe(true);
        expect(canManage({ phase: 'grouping' })).toBe(false);
        expect(canManage({ phase: 'writing' }, { isFacilitator: false })).toBe(
            false,
        );
    });
});

describe('writingProgress', () => {
    it('counts every card, masked ones included, and the writers over the people present', () => {
        const board = retroSnapshot({
            columns,
            cards: [card(), card({ id: 'c2', hidden: true })],
            writersCount: 1,
        });

        expect(writingProgress(board, 2)).toEqual({
            cards: 2,
            written: 1,
            present: 2,
        });
    });

    it('never shows more writers than people', () => {
        const board = retroSnapshot({ columns, writersCount: 3 });

        expect(writingProgress(board, 2)).toEqual({
            cards: 0,
            written: 3,
            present: 3,
        });
    });
});

describe('toHealthStatements', () => {
    const statement = {
        key: 'interaction',
        label: 'Interaction',
        text: 'Interaction with colleagues was productive',
        isBuiltin: true,
        count: 3,
        answeredBy: ['me', 'gone', 'carol'],
        myScore: 7,
    };

    it('is empty on a retro without a health check', () => {
        expect(toHealthStatements(retroSnapshot())).toEqual([]);
    });

    it('keeps the server fields and resolves who answered, leaving out someone the board no longer knows', () => {
        const board = retroSnapshot({
            healthCheck: { statements: [statement] },
            participants: [
                {
                    id: 'me',
                    name: 'Alice Martin',
                    avatarUrl: '/a.svg',
                    isGuest: false,
                },
                {
                    id: 'carol',
                    name: 'Carol Guest',
                    avatarUrl: '/c.svg',
                    isGuest: true,
                },
            ],
        });

        expect(toHealthStatements(board)).toEqual([
            {
                key: 'interaction',
                label: 'Interaction',
                text: 'Interaction with colleagues was productive',
                myScore: 7,
                count: 3,
                answeredBy: [
                    { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg' },
                    { id: 'carol', name: 'Carol Guest', avatarUrl: '/c.svg' },
                ],
            },
        ]);
    });

    it('has a count and nobody on an anonymous retro', () => {
        const board = retroSnapshot({
            healthCheck: {
                statements: [{ ...statement, answeredBy: [], myScore: null }],
            },
        });

        expect(toHealthStatements(board)[0]).toMatchObject({
            count: 3,
            answeredBy: [],
            myScore: null,
        });
    });
});

describe('toGroupProps', () => {
    const lead = card({ id: 'lead', columnId: 'stop', content: 'Slow CI' });
    const second = card({
        id: 'second',
        columnId: 'stop',
        parentCardId: 'lead',
        position: 1,
        content: 'Flaky tests',
    });
    const first = card({
        id: 'first',
        columnId: 'stop',
        parentCardId: 'lead',
        position: 0,
        content: 'Slow deploys',
    });

    function board(retro: Parameters<typeof retroSnapshot>[0] = {}) {
        return retroSnapshot({
            columns,
            cards: [lead, second, first],
            retro: { phase: 'grouping' },
            ...retro,
        });
    }

    it('is nothing for a card that leads no other card', () => {
        expect(toGroupProps(first, board())).toBeNull();
        expect(
            toGroupProps(lead, retroSnapshot({ columns, cards: [lead] })),
        ).toBeNull();
    });

    it('puts the lead first, then its cards in their order, under the colour of the column', () => {
        const group = toGroupProps(lead, board());

        expect(group).toMatchObject({
            id: 'lead',
            domId: 'group-lead',
            title: '',
            color: 'coral',
            titleMaxLength: 60,
        });
        expect(group?.cards.map((member) => member.id)).toEqual([
            'lead',
            'first',
            'second',
        ]);
        expect(group?.cards[1]).toMatchObject({
            text: 'Slow deploys',
            color: 'coral',
        });
    });

    it('takes the name of the group from its lead', () => {
        const named = { ...lead, groupName: 'Delivery pain' };

        expect(
            toGroupProps(named, board({ cards: [named, first] }))?.title,
        ).toBe('Delivery pain');
    });

    it('lets everyone name a group from Grouping to Discussing, on an open board', () => {
        const canEdit = (retro: Parameters<typeof board>[0]) =>
            toGroupProps(lead, board(retro))?.canEdit;

        expect(canEdit({ retro: { phase: 'grouping' } })).toBe(true);
        expect(canEdit({ retro: { phase: 'voting' } })).toBe(true);
        expect(canEdit({ retro: { phase: 'discussing' } })).toBe(true);
        expect(canEdit({ retro: { phase: 'completed' } })).toBe(false);
        expect(canEdit({ retro: { phase: 'grouping', isLocked: true } })).toBe(
            false,
        );
    });

    it('lets a card leave its group in Grouping only', () => {
        const canUngroup = (retro: Parameters<typeof board>[0]) =>
            toGroupProps(lead, board(retro))?.canUngroup;

        expect(canUngroup({ retro: { phase: 'grouping' } })).toBe(true);
        expect(canUngroup({ retro: { phase: 'voting' } })).toBe(false);
        expect(
            canUngroup({ retro: { phase: 'grouping', isLocked: true } }),
        ).toBe(false);
    });
});

describe('groupingProgress', () => {
    it('counts the groups and every card, grouped ones included', () => {
        const lead = card({ id: 'lead' });
        const child = card({ id: 'child', parentCardId: 'lead' });
        const alone = card({ id: 'alone', position: 1 });

        expect(
            groupingProgress(
                retroSnapshot({ columns, cards: [lead, child, alone] }),
            ),
        ).toEqual({ groups: 1, cards: 3 });
    });
});

describe('cardEngagement', () => {
    const reacted = card({
        isMine: false,
        reactions: [{ emoji: '👍', count: 1, mine: false, names: [] }],
        commentCount: 1,
    });

    function engagement(
        retro: NonNullable<Parameters<typeof retroSnapshot>[0]>['retro'],
        target = reacted,
    ) {
        return cardEngagement(
            target,
            retroSnapshot({ columns, cards: [target], retro }),
        );
    }

    it('opens reactions and comments from Grouping to Discussing', () => {
        expect(engagement({ phase: 'grouping' })).toEqual({
            reactions: reacted.reactions,
            canReact: true,
            showsComments: true,
            canComment: true,
        });
        expect(engagement({ phase: 'voting' }).canReact).toBe(true);
        expect(engagement({ phase: 'discussing' }).canComment).toBe(true);
    });

    it('keeps what was said readable once the retro is completed or the board is closed', () => {
        expect(engagement({ phase: 'completed' })).toEqual({
            reactions: reacted.reactions,
            canReact: false,
            showsComments: true,
            canComment: false,
        });
        expect(engagement({ phase: 'grouping', isLocked: true })).toMatchObject(
            { canReact: false, canComment: false, showsComments: true },
        );
    });

    it('shows no reaction at all when the retro has them off', () => {
        expect(
            engagement({ phase: 'grouping', reactionsEnabled: false }),
        ).toMatchObject({ reactions: [], canReact: false });
    });

    it('has no comments in Writing unless one was already written', () => {
        expect(
            engagement({ phase: 'writing' }, card({ commentCount: 0 }))
                .showsComments,
        ).toBe(false);
        expect(engagement({ phase: 'writing' }).showsComments).toBe(true);
        expect(engagement({ phase: 'writing' }).canComment).toBe(false);
    });

    it('offers nothing on a card that is still hidden', () => {
        expect(
            engagement(
                { phase: 'writing' },
                card({ hidden: true, content: null, commentCount: 2 }),
            ),
        ).toEqual({
            reactions: [],
            canReact: false,
            showsComments: false,
            canComment: false,
        });
    });
});

describe('cardVoting', () => {
    const voting = (
        overrides: Parameters<typeof retroSnapshot>[0] = {},
        voted: Partial<BoardCard> = {},
    ) => {
        const mine = card({ votes: 3, myVotes: 1, ...voted });
        const { retro, ...rest } = overrides;

        return cardVoting(
            mine,
            retroSnapshot({
                columns,
                cards: [mine],
                retro: { phase: 'voting', ...retro },
                ...rest,
            }),
        );
    };

    it('gives the total and my votes, and opens both ways while votes are left', () => {
        expect(voting()).toEqual({
            votes: { total: 3, mine: 1 },
            canVote: true,
            canUnvote: true,
            blocked: null,
        });
    });

    it('keeps the total hidden when the server sends none', () => {
        expect(voting({}, { votes: null })?.votes).toEqual({
            total: null,
            mine: 1,
        });
    });

    it('adds no vote once the budget is spent, and still takes one back', () => {
        expect(voting({ viewer: { remainingVotes: 0 } })).toMatchObject({
            canVote: false,
            canUnvote: true,
            blocked: 'spent',
        });
    });

    it('takes nothing back from a card I did not vote for', () => {
        expect(voting({}, { myVotes: 0 })).toMatchObject({
            canVote: true,
            canUnvote: false,
        });
    });

    it('is closed both ways on a closed board', () => {
        expect(voting({ retro: { isLocked: true } })).toMatchObject({
            canVote: false,
            canUnvote: false,
            blocked: 'locked',
        });
    });

    it('is nothing outside Voting, on a card inside a group, and on a hidden card', () => {
        for (const phase of ['grouping', 'discussing', 'completed'] as const) {
            expect(voting({ retro: { phase } })).toBeNull();
        }

        expect(voting({}, { parentCardId: 'lead' })).toBeNull();
        expect(voting({}, { hidden: true })).toBeNull();
    });
});

describe('votingProgress', () => {
    it('counts the votes cast over the votes of everyone', () => {
        expect(
            votingProgress(
                retroSnapshot({
                    retro: { votesPerParticipant: 2 },
                    participants: [
                        {
                            id: 'me',
                            name: 'Alice Martin',
                            avatarUrl: '/a.svg',
                            isGuest: false,
                        },
                        {
                            id: 'bob',
                            name: 'Bob Stone',
                            avatarUrl: '/a.svg',
                            isGuest: false,
                        },
                    ],
                    votesCast: 3,
                }),
            ),
        ).toEqual({ cast: 3, total: 4 });
    });

    it('starts at zero before the first vote', () => {
        expect(votingProgress(retroSnapshot())).toEqual({ cast: 0, total: 5 });
    });
});
