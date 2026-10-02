import { compareActionItems } from '@/lib/action-items/order';
import type { ExternalLink } from '@/types/integrations';
import type {
    ActionItem,
    BoardCard,
    BoardColumn,
    CardComment,
    CardPayload,
    CommentThread,
    HealthProgress,
    ReactionSummary,
    Snapshot,
    SuggestedAction,
    SurveyPayload,
} from './types';

export type BoardAction =
    | { type: 'insights.suggestion'; suggestedAction: SuggestedAction }
    | { type: 'survey.upsert'; survey: SurveyPayload }
    | { type: 'survey.remove'; surveyId: string }
    | {
          type: 'survey.counts';
          surveyId: string;
          responseCount?: number;
          commentCount?: number;
      }
    | { type: 'replace'; snapshot: Snapshot }
    | {
          type: 'roti.set';
          respondents: number;
          voterIds?: string[];
          myScore?: number | null;
      }
    | { type: 'writers.set'; writersCount: number }
    | { type: 'card.groupName'; cardId: string; groupName: string | null }
    | { type: 'health.progress'; statements: HealthProgress[] }
    | { type: 'health.answer'; key: string; score: number | null }
    | { type: 'cards.upsert'; cards: CardPayload[] }
    | { type: 'card.remove'; cardId: string; ungroupedCards: CardPayload[] }
    | { type: 'card.place'; cardId: string; columnId: string; index: number }
    | { type: 'columns.set'; columns: BoardColumn[] }
    | {
          type: 'votes.cast';
          votesCast: number;
          votesVersion: number;
          cardId?: string;
          total?: number;
      }
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
    | { type: 'actionItem.remove'; actionItemId: string }
    | {
          type: 'actionItem.externalLinks';
          actionItemId: string;
          externalLinks: ExternalLink[];
      }
    | {
          type: 'actionItem.comments';
          actionItemId: string;
          commentCount: number;
          refresh: boolean;
      }
    | { type: 'carriedActionItem.upsert'; actionItem: ActionItem }
    | { type: 'carriedActionItem.remove'; actionItemId: string }
    | {
          type: 'reactions.set';
          cardId: string;
          reactions: Array<Omit<ReactionSummary, 'mine'> & { mine?: boolean }>;
      }
    | { type: 'comment.upsert'; comment: CardComment }
    | {
          type: 'comment.remove';
          cardId: string;
          commentId: string;
          soft: boolean;
      };

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
            totalVersion: existing?.totalVersion,
            reactions: existing?.reactions ?? [],
            commentCount: existing?.commentCount ?? 0,
            comments: existing?.comments ?? [],
            sentiment: existing?.sentiment ?? null,
            category: existing?.category ?? null,
            ...payload,
            ...(keepsOwnView && {
                isMine: true,
                hidden: false,
                content: payload.content ?? existing.content,
                gif: payload.gif ?? existing.gif,
                author: payload.author ?? existing.author,
                groupName: payload.hidden
                    ? existing.groupName
                    : payload.groupName,
            }),
        });
    }

    return [...byId.values()];
}

function countComments(threads: CommentThread[]): number {
    return threads.reduce(
        (total, thread) =>
            total +
            (thread.deleted ? 0 : 1) +
            thread.replies.filter((reply) => !reply.deleted).length,
        0,
    );
}

/**
 * Comment broadcasts are presented without a viewer, so they never mark a
 * comment as mine and drop the author on anonymous retros; the viewer's
 * own copy keeps both.
 */
function mergeComment<T extends CardComment>(existing: T, incoming: T): T {
    if (!existing.isMine || incoming.isMine) {
        return incoming;
    }

    return {
        ...incoming,
        isMine: true,
        author: incoming.author ?? existing.author,
    };
}

function upsertComment(
    threads: CommentThread[],
    comment: CardComment,
): CommentThread[] {
    if (comment.parentCommentId === null) {
        const exists = threads.some((thread) => thread.id === comment.id);

        return exists
            ? threads.map((thread) =>
                  thread.id === comment.id
                      ? {
                            ...mergeComment<CardComment>(thread, comment),
                            replies: thread.replies,
                        }
                      : thread,
              )
            : [...threads, { ...comment, replies: [] }];
    }

    return threads.map((thread) => {
        if (thread.id !== comment.parentCommentId) {
            return thread;
        }

        const exists = thread.replies.some((reply) => reply.id === comment.id);

        return {
            ...thread,
            replies: exists
                ? thread.replies.map((reply) =>
                      reply.id === comment.id
                          ? mergeComment(reply, comment)
                          : reply,
                  )
                : [...thread.replies, comment],
        };
    });
}

function removeComment(
    threads: CommentThread[],
    commentId: string,
    soft: boolean,
): CommentThread[] {
    if (soft) {
        return threads.map((thread) =>
            thread.id === commentId
                ? { ...thread, deleted: true, content: null, author: null }
                : thread,
        );
    }

    return threads
        .filter((thread) => thread.id !== commentId)
        .map((thread) => ({
            ...thread,
            replies: thread.replies.filter((reply) => reply.id !== commentId),
        }));
}

function updateCard(
    state: Snapshot,
    cardId: string,
    change: (card: BoardCard) => BoardCard,
): Snapshot {
    return {
        ...state,
        cards: state.cards.map((card) =>
            card.id === cardId ? change(card) : card,
        ),
    };
}

/**
 * Stamps every card with the snapshot's votes version, so a total from an
 * event older than the snapshot is never applied over the snapshot's.
 */
export function seedTotalVersions(snapshot: Snapshot): Snapshot {
    return {
        ...snapshot,
        cards: snapshot.cards.map((card) => ({
            ...card,
            totalVersion: snapshot.votesVersion,
        })),
    };
}

function applyCardTotal(
    cards: BoardCard[],
    cardId: string | undefined,
    total: number | undefined,
    votesVersion: number,
): BoardCard[] {
    const target = cards.find((card) => card.id === cardId);

    if (target === undefined || total === undefined) {
        return cards;
    }

    if (votesVersion <= (target.totalVersion ?? 0)) {
        return cards;
    }

    return cards.map((card) =>
        card === target
            ? { ...card, votes: total, totalVersion: votesVersion }
            : card,
    );
}

function placeCard(
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

/**
 * Broadcast payloads are presented without a viewer, so they never mark
 * an item as mine; the known copy keeps it and its comment revision.
 */
function upsertActionItem(
    items: ActionItem[],
    incoming: ActionItem,
): ActionItem[] {
    const existing = items.find((item) => item.id === incoming.id);

    if (!existing) {
        return [...items, incoming];
    }

    return items.map((item) =>
        item.id === incoming.id
            ? {
                  ...incoming,
                  isMine: incoming.isMine || existing.isMine,
                  commentsRevision: existing.commentsRevision,
                  externalLinks:
                      incoming.externalLinks ?? existing.externalLinks,
                  completedVia:
                      incoming.completedAt === null
                          ? null
                          : (incoming.completedVia ?? existing.completedVia),
              }
            : item,
    );
}

export function countActionItemComments(
    items: ActionItem[],
    actionItemId: string,
    commentCount: number,
    refresh: boolean,
): ActionItem[] {
    return items.map((item) =>
        item.id === actionItemId
            ? {
                  ...item,
                  commentCount,
                  commentsRevision: refresh
                      ? (item.commentsRevision ?? 0) + 1
                      : item.commentsRevision,
              }
            : item,
    );
}

export function boardReducer(state: Snapshot, action: BoardAction): Snapshot {
    switch (action.type) {
        case 'insights.suggestion':
            if (state.insights === null) {
                return state;
            }

            return {
                ...state,
                insights: {
                    ...state.insights,
                    suggestedActions: state.insights.suggestedActions.map(
                        (suggestion) =>
                            suggestion.id === action.suggestedAction.id
                                ? action.suggestedAction
                                : suggestion,
                    ),
                },
            };
        case 'replace':
            return seedTotalVersions(action.snapshot);
        case 'roti.set':
            return {
                ...state,
                roti: {
                    ...state.roti,
                    myScore:
                        action.myScore === undefined
                            ? state.roti.myScore
                            : action.myScore,
                    respondents: action.respondents,
                    voterIds: action.voterIds ?? state.roti.voterIds,
                },
            };
        case 'writers.set':
            return { ...state, writersCount: action.writersCount };
        case 'card.groupName':
            return updateCard(state, action.cardId, (card) => ({
                ...card,
                groupName: action.groupName,
            }));
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
        case 'votes.cast': {
            const cards = applyCardTotal(
                state.cards,
                action.cardId,
                action.total,
                action.votesVersion,
            );

            if (action.votesVersion <= state.votesVersion) {
                return cards === state.cards ? state : { ...state, cards };
            }

            return {
                ...state,
                votesCast: action.votesCast,
                votesVersion: action.votesVersion,
                cards,
            };
        }
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
        case 'actionItem.upsert':
            return {
                ...state,
                actionItems: upsertActionItem(
                    state.actionItems,
                    action.actionItem,
                ),
            };
        case 'actionItem.comments':
            return {
                ...state,
                actionItems: countActionItemComments(
                    state.actionItems,
                    action.actionItemId,
                    action.commentCount,
                    action.refresh,
                ),
                carriedActionItems: countActionItemComments(
                    state.carriedActionItems,
                    action.actionItemId,
                    action.commentCount,
                    action.refresh,
                ),
            };
        case 'carriedActionItem.upsert':
            return {
                ...state,
                carriedActionItems: upsertActionItem(
                    state.carriedActionItems,
                    action.actionItem,
                ).sort(compareActionItems),
            };
        case 'carriedActionItem.remove':
            return {
                ...state,
                carriedActionItems: state.carriedActionItems.filter(
                    (item) => item.id !== action.actionItemId,
                ),
            };
        case 'actionItem.remove':
            return {
                ...state,
                actionItems: state.actionItems.filter(
                    (item) => item.id !== action.actionItemId,
                ),
            };
        case 'actionItem.externalLinks': {
            const withLinks = (items: ActionItem[]): ActionItem[] =>
                items.map((item) =>
                    item.id === action.actionItemId
                        ? { ...item, externalLinks: action.externalLinks }
                        : item,
                );

            return {
                ...state,
                actionItems: withLinks(state.actionItems),
                carriedActionItems: withLinks(state.carriedActionItems),
            };
        }
        case 'reactions.set':
            return updateCard(state, action.cardId, (card) => ({
                ...card,
                reactions: action.reactions.map((reaction) => ({
                    ...reaction,
                    mine:
                        reaction.mine ??
                        card.reactions.some(
                            (existing) =>
                                existing.emoji === reaction.emoji &&
                                existing.mine,
                        ),
                })),
            }));
        case 'comment.upsert':
            return updateCard(state, action.comment.cardId, (card) => {
                const comments = upsertComment(card.comments, action.comment);

                return {
                    ...card,
                    comments,
                    commentCount: countComments(comments),
                };
            });
        case 'comment.remove':
            return updateCard(state, action.cardId, (card) => {
                const comments = removeComment(
                    card.comments,
                    action.commentId,
                    action.soft,
                );

                return {
                    ...card,
                    comments,
                    commentCount: countComments(comments),
                };
            });
        case 'health.progress': {
            if (!state.healthCheck) {
                return state;
            }

            const progress = new Map(
                action.statements.map((statement) => [
                    statement.key,
                    statement,
                ]),
            );

            return {
                ...state,
                healthCheck: {
                    statements: state.healthCheck.statements.map(
                        (statement) => {
                            const update = progress.get(statement.key);

                            return update
                                ? {
                                      ...statement,
                                      count: update.count,
                                      answeredBy: update.answeredBy,
                                  }
                                : statement;
                        },
                    ),
                },
            };
        }
        case 'health.answer':
            if (!state.healthCheck) {
                return state;
            }

            return {
                ...state,
                healthCheck: {
                    statements: state.healthCheck.statements.map((statement) =>
                        statement.key === action.key
                            ? { ...statement, myScore: action.score }
                            : statement,
                    ),
                },
            };
        case 'survey.upsert':
            return {
                ...state,
                surveys: [
                    ...state.surveys.filter(
                        (survey) => survey.id !== action.survey.id,
                    ),
                    action.survey,
                ].sort((a, b) => a.position - b.position),
            };
        case 'survey.remove':
            return {
                ...state,
                surveys: state.surveys.filter(
                    (survey) => survey.id !== action.surveyId,
                ),
            };
        case 'survey.counts':
            return {
                ...state,
                surveys: state.surveys.map((survey) =>
                    survey.id === action.surveyId
                        ? {
                              ...survey,
                              responseCount:
                                  action.responseCount ?? survey.responseCount,
                              commentCount:
                                  action.commentCount ?? survey.commentCount,
                          }
                        : survey,
                ),
            };
    }
}
