import { describe, expect, it } from 'vitest';
import {
    toCardProps,
    toColumnProps,
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

    it('counts the top-level cards and knows its neighbours', () => {
        const board = retroSnapshot({ columns, cards });

        expect(toColumnProps(columns[0], board)).toMatchObject({
            id: 'start',
            title: 'Start',
            color: 'moss',
            description: null,
            count: 2,
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
