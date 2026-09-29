import type {
    ActionItem,
    BoardCard,
    BoardColumn,
    CardPayload,
    Snapshot,
} from './types';

export type BoardAction =
    | { type: 'replace'; snapshot: Snapshot }
    | { type: 'cards.upsert'; cards: CardPayload[] }
    | { type: 'card.remove'; cardId: string; ungroupedCards: CardPayload[] }
    | { type: 'card.place'; cardId: string; columnId: string; index: number }
    | { type: 'columns.set'; columns: BoardColumn[] }
    | { type: 'votes.cast'; votesCast: number; votesVersion: number }
    | {
          type: 'votes.tally';
          cardId: string;
          myVotes: number;
          remainingVotes: number;
          /** Absent on the optimistic tally dispatched before the request. */
          votesVersion?: number;
      }
    | { type: 'timer.set'; timerEndsAt: string | null }
    | { type: 'highlight.set'; cardId: string | null }
    | { type: 'actionItem.upsert'; actionItem: ActionItem }
    | { type: 'actionItem.remove'; actionItemId: string };

export function sortByVotes<
    T extends { votes: number | null; position: number },
>(cards: T[]): T[] {
    return [...cards].sort(
        (a, b) => (b.votes ?? 0) - (a.votes ?? 0) || a.position - b.position,
    );
}

export function topLevelCards(
    cards: BoardCard[],
    columnId: string,
): BoardCard[] {
    return cards
        .filter(
            (card) => card.columnId === columnId && card.parentCardId === null,
        )
        .sort((a, b) => a.position - b.position);
}

export function childrenOf(cards: BoardCard[], cardId: string): BoardCard[] {
    return cards
        .filter((card) => card.parentCardId === cardId)
        .sort((a, b) => a.position - b.position);
}

function upsertCards(cards: BoardCard[], payloads: CardPayload[]): BoardCard[] {
    const byId = new Map(cards.map((card) => [card.id, card]));

    for (const payload of payloads) {
        const existing = byId.get(payload.id);
        // Broadcast payloads are presented without a viewer, so they never
        // mark a card as mine and redact what only its author may see.
        const keepsOwnView = existing?.isMine === true && !payload.isMine;

        byId.set(payload.id, {
            votes: existing?.votes ?? null,
            myVotes: existing?.myVotes ?? 0,
            ...payload,
            ...(keepsOwnView && {
                isMine: true,
                content: payload.content ?? existing.content,
                author: payload.author ?? existing.author,
            }),
        });
    }

    return [...byId.values()];
}

export function placeCard(
    cards: BoardCard[],
    cardId: string,
    columnId: string,
    index: number,
): BoardCard[] {
    const moving = cards.find((card) => card.id === cardId);

    if (!moving) {
        return cards;
    }

    const siblings = topLevelCards(cards, columnId).filter(
        (card) => card.id !== cardId,
    );
    siblings.splice(Math.min(Math.max(index, 0), siblings.length), 0, {
        ...moving,
        parentCardId: null,
    });

    const updates = new Map<string, BoardCard>();
    siblings.forEach((card, position) =>
        updates.set(card.id, { ...card, columnId, position }),
    );
    cards
        .filter((card) => card.parentCardId === cardId)
        .forEach((child) => updates.set(child.id, { ...child, columnId }));

    if (moving.columnId !== columnId) {
        topLevelCards(cards, moving.columnId)
            .filter((card) => card.id !== cardId)
            .forEach((card, position) =>
                updates.set(card.id, { ...card, position }),
            );
    }

    return cards.map((card) => updates.get(card.id) ?? card);
}

export function boardReducer(state: Snapshot, action: BoardAction): Snapshot {
    switch (action.type) {
        case 'replace':
            return action.snapshot;
        case 'cards.upsert':
            return { ...state, cards: upsertCards(state.cards, action.cards) };
        case 'card.remove':
            return {
                ...state,
                cards: upsertCards(
                    state.cards.filter((card) => card.id !== action.cardId),
                    action.ungroupedCards,
                ),
            };
        case 'card.place':
            return {
                ...state,
                cards: placeCard(
                    state.cards,
                    action.cardId,
                    action.columnId,
                    action.index,
                ),
            };
        case 'columns.set':
            return {
                ...state,
                columns: [...action.columns].sort(
                    (a, b) => a.position - b.position,
                ),
            };
        case 'votes.cast':
            if (action.votesVersion <= state.votesVersion) {
                return state;
            }

            return {
                ...state,
                votesCast: action.votesCast,
                votesVersion: action.votesVersion,
            };
        case 'votes.tally':
            if (
                action.votesVersion !== undefined &&
                action.votesVersion < state.votesVersion
            ) {
                return state;
            }

            return {
                ...state,
                viewer: {
                    ...state.viewer,
                    remainingVotes: action.remainingVotes,
                },
                cards: state.cards.map((card) =>
                    card.id === action.cardId
                        ? { ...card, myVotes: action.myVotes }
                        : card,
                ),
            };
        case 'timer.set':
            return {
                ...state,
                retro: { ...state.retro, timerEndsAt: action.timerEndsAt },
            };
        case 'highlight.set':
            return {
                ...state,
                retro: { ...state.retro, highlightedCardId: action.cardId },
            };
        case 'actionItem.upsert': {
            const exists = state.actionItems.some(
                (item) => item.id === action.actionItem.id,
            );

            return {
                ...state,
                actionItems: exists
                    ? state.actionItems.map((item) =>
                          item.id === action.actionItem.id
                              ? action.actionItem
                              : item,
                      )
                    : [...state.actionItems, action.actionItem],
            };
        }
        case 'actionItem.remove':
            return {
                ...state,
                actionItems: state.actionItems.filter(
                    (item) => item.id !== action.actionItemId,
                ),
            };
    }
}
