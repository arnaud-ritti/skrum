import { describe, expect, it } from 'vitest';
import {
    actionCountByTopic,
    stepTopic,
    topicOfCard,
    topicsFrom,
} from '@/lib/retro/topics';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';

function column(overrides: Partial<BoardColumn> = {}): BoardColumn {
    return {
        id: 'start',
        title: 'Start',
        description: null,
        color: 'moss',
        position: 0,
        ...overrides,
    };
}

function card(overrides: Partial<BoardCard> = {}): BoardCard {
    return {
        id: 'card',
        columnId: 'start',
        parentCardId: null,
        position: 0,
        isMine: false,
        hidden: false,
        content: 'Slow CI',
        gif: null,
        author: null,
        groupName: null,
        discussedAt: null,
        votes: 0,
        myVotes: 0,
        reactions: [],
        commentCount: 0,
        comments: [],
        sentiment: null,
        category: null,
        ...overrides,
    };
}

const columns = [column(), column({ id: 'stop', title: 'Stop', position: 1 })];

function ids(cards: BoardCard[]): string[] {
    return topicsFrom({ cards, columns }).map((topic) => topic.id);
}

describe('topicsFrom', () => {
    it('makes one topic per lone card and per group, never one for a grouped card', () => {
        const topics = topicsFrom({
            columns,
            cards: [
                card({ id: 'lone', content: 'Flaky tests' }),
                card({ id: 'lead', position: 1, groupName: 'Pipeline' }),
                card({ id: 'child', parentCardId: 'lead', content: 'Slow' }),
            ],
        });

        expect(topics).toEqual([
            {
                id: 'lone',
                leadCardId: 'lone',
                title: 'Flaky tests',
                votes: 0,
                columnId: 'start',
                cardIds: ['lone'],
            },
            {
                id: 'lead',
                leadCardId: 'lead',
                title: 'Pipeline',
                votes: 0,
                columnId: 'start',
                cardIds: ['lead', 'child'],
            },
        ]);
    });

    it('orders by votes, the most voted first', () => {
        expect(
            ids([
                card({ id: 'one', votes: 1 }),
                card({ id: 'three', votes: 3, position: 1 }),
                card({ id: 'two', votes: 2, position: 2 }),
            ]),
        ).toEqual(['three', 'two', 'one']);
    });

    it('breaks a tie by the position of the column, then of the card, whatever order the cards come in', () => {
        const cards = [
            card({ id: 'stop-first', columnId: 'stop', position: 0, votes: 2 }),
            card({ id: 'start-second', position: 1, votes: 2 }),
            card({ id: 'start-first', position: 0, votes: 2 }),
        ];

        expect(ids(cards)).toEqual([
            'start-first',
            'start-second',
            'stop-first',
        ]);
        expect(ids([...cards].reverse())).toEqual([
            'start-first',
            'start-second',
            'stop-first',
        ]);
    });

    it('counts for a group the votes of the group, held by its lead card', () => {
        const [first, second] = topicsFrom({
            columns,
            cards: [
                card({ id: 'lone', votes: 2 }),
                card({ id: 'lead', position: 1, votes: 3 }),
                card({ id: 'child', parentCardId: 'lead', votes: 5 }),
            ],
        });

        expect(first).toMatchObject({ id: 'lead', votes: 3 });
        expect(second).toMatchObject({ id: 'lone', votes: 2 });
    });

    it('never reorders on hidden totals: the board order is kept', () => {
        const topics = topicsFrom({
            columns,
            cards: [
                card({ id: 'b', position: 1, votes: null }),
                card({ id: 'a', position: 0, votes: null }),
                card({ id: 'c', columnId: 'stop', votes: null }),
            ],
        });

        expect(topics.map((topic) => topic.id)).toEqual(['a', 'b', 'c']);
        expect(topics.every((topic) => topic.votes === 0)).toBe(true);
    });

    it('titles an unnamed group and a lone card after the first card, and a GIF alone with nothing', () => {
        const topics = topicsFrom({
            columns,
            cards: [
                card({ id: 'lead', content: 'Slow CI' }),
                card({ id: 'child', parentCardId: 'lead' }),
                card({ id: 'gif', position: 1, content: null }),
            ],
        });

        expect(topics.map((topic) => topic.title)).toEqual(['Slow CI', '']);
    });

    it('lists the cards of a group in their order, the lead first', () => {
        const [topic] = topicsFrom({
            columns,
            cards: [
                card({ id: 'second', parentCardId: 'lead', position: 1 }),
                card({ id: 'lead' }),
                card({ id: 'first', parentCardId: 'lead', position: 0 }),
            ],
        });

        expect(topic.cardIds).toEqual(['lead', 'first', 'second']);
    });
});

describe('topicOfCard', () => {
    const topics = topicsFrom({
        columns,
        cards: [
            card({ id: 'lead' }),
            card({ id: 'child', parentCardId: 'lead' }),
        ],
    });

    it('finds the topic of a lead and of a grouped card', () => {
        expect(topicOfCard(topics, 'lead')?.id).toBe('lead');
        expect(topicOfCard(topics, 'child')?.id).toBe('lead');
    });

    it('has none for no card or an unknown one', () => {
        expect(topicOfCard(topics, null)).toBeNull();
        expect(topicOfCard(topics, 'gone')).toBeNull();
    });
});

describe('stepTopic', () => {
    const topics = topicsFrom({
        columns,
        cards: [
            card({ id: 'a', votes: 3 }),
            card({ id: 'b', votes: 2 }),
            card({ id: 'c', votes: 1 }),
        ],
    });

    it('gives the neighbour, and none past either end', () => {
        expect(stepTopic(topics, 'b', 1)?.id).toBe('c');
        expect(stepTopic(topics, 'b', -1)?.id).toBe('a');
        expect(stepTopic(topics, 'a', -1)).toBeNull();
        expect(stepTopic(topics, 'c', 1)).toBeNull();
    });

    it('has no neighbour for an unknown topic', () => {
        expect(stepTopic(topics, 'gone', 1)).toBeNull();
    });
});

describe('actionCountByTopic', () => {
    it('counts the action items of each topic, and leaves out those without one', () => {
        expect(
            actionCountByTopic([
                { cardId: 'a' },
                { cardId: 'b' },
                { cardId: 'a' },
                { cardId: null },
            ]),
        ).toEqual(
            new Map([
                ['a', 2],
                ['b', 1],
            ]),
        );
    });
});
