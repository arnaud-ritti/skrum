import type { Snapshot } from './types';

/**
 * What the room discusses: a group, or a card that stands alone. The id is
 * the id of the lead card, by which the server knows a group.
 */
export type Topic = {
    id: string;
    leadCardId: string;
    /** The name of the group, or what the first card says; empty for a GIF alone. */
    title: string;
    votes: number;
    columnId: string;
    /** The lead first, then the cards grouped under it. */
    cardIds: string[];
};

/**
 * The topics of a board, the most voted first. Ties follow the board: the
 * position of the column, then of the card, so that two browsers show the
 * same order. Hidden totals count for nothing and leave the board order.
 */
export function topicsFrom(
    board: Pick<Snapshot, 'cards' | 'columns'>,
): Topic[] {
    const columnRank = new Map(
        [...board.columns]
            .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
            .map((column, index) => [column.id, index]),
    );
    const rankOf = (columnId: string): number =>
        columnRank.get(columnId) ?? Number.MAX_SAFE_INTEGER;

    return board.cards
        .filter((card) => card.parentCardId === null)
        .map((lead) => ({
            lead,
            members: board.cards
                .filter((card) => card.parentCardId === lead.id)
                .sort(
                    (a, b) =>
                        a.position - b.position || a.id.localeCompare(b.id),
                ),
        }))
        .sort(
            (a, b) =>
                (b.lead.votes ?? 0) - (a.lead.votes ?? 0) ||
                rankOf(a.lead.columnId) - rankOf(b.lead.columnId) ||
                a.lead.position - b.lead.position ||
                a.lead.id.localeCompare(b.lead.id),
        )
        .map(({ lead, members }) => ({
            id: lead.id,
            leadCardId: lead.id,
            title: (lead.groupName ?? lead.content ?? '').trim(),
            votes: lead.votes ?? 0,
            columnId: lead.columnId,
            cardIds: [lead.id, ...members.map((card) => card.id)],
        }));
}

/** The topic a card belongs to, as its lead or as one of its grouped cards. */
export function topicOfCard(
    topics: Topic[],
    cardId: string | null,
): Topic | null {
    if (cardId === null) {
        return null;
    }

    return topics.find((topic) => topic.cardIds.includes(cardId)) ?? null;
}

/** The topic before or after one; none past either end of the list. */
export function stepTopic(
    topics: Topic[],
    topicId: string | null,
    offset: -1 | 1,
): Topic | null {
    const index = topics.findIndex((topic) => topic.id === topicId);

    if (index === -1) {
        return null;
    }

    return topics[index + offset] ?? null;
}
