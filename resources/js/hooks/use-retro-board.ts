import { useCallback, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import RetroSnapshotsController from '@/actions/App/Http/Controllers/Retros/RetroSnapshotsController';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    boardReducer,
    seedTotalVersions,
    type BoardAction,
} from '@/lib/retro/board-reducer';
import type {
    ActionItem,
    BoardColumn,
    CardComment,
    CardPayload,
    CommentNotificationPayload,
    PresenceMember,
    ReactionSummary,
    Snapshot,
} from '@/lib/retro/types';
import { useCommentNotifications } from './use-comment-notifications';
import { useRetroChannel, type RetroEvent } from './use-retro-channel';

const SessionExpiredStatuses = [401, 419];

export type BoardStatus = 'active' | 'ended' | 'deleted';

export function useRetroBoard(initial: Snapshot) {
    const { t } = useTrans();
    const [board, dispatch] = useReducer(
        boardReducer,
        initial,
        seedTotalVersions,
    );
    const [status, setStatus] = useState<BoardStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const isActive = useRef(true);
    const latestRefetch = useRef(0);
    const bufferedActions = useRef<BoardAction[] | null>(null);
    const latestBoard = useRef(board);
    const retroId = initial.retro.id;

    latestBoard.current = board;

    /**
     * While a refetch is in flight, broadcast actions are held back and
     * replayed after its snapshot so events committed after the snapshot
     * was built are not wiped by it.
     */
    const apply = useCallback((action: BoardAction) => {
        if (bufferedActions.current) {
            bufferedActions.current.push(action);

            return;
        }

        dispatch(action);
    }, []);

    const flushBufferedActions = useCallback(() => {
        const actions = bufferedActions.current ?? [];

        bufferedActions.current = null;

        for (const action of actions) {
            dispatch(action);
        }
    }, []);

    const end = useCallback((reason: Exclude<BoardStatus, 'active'>) => {
        if (!isActive.current) {
            return;
        }

        isActive.current = false;
        setStatus(reason);
    }, []);

    const refetch = useCallback(async () => {
        if (!isActive.current) {
            return;
        }

        const request = ++latestRefetch.current;

        bufferedActions.current ??= [];

        try {
            const snapshot = await retroRequest<Snapshot>(
                RetroSnapshotsController.show(retroId),
            );

            if (request !== latestRefetch.current || !isActive.current) {
                return;
            }

            dispatch({ type: 'replace', snapshot });
        } catch (error) {
            if (!(error instanceof RetroRequestError)) {
                return;
            }

            if (SessionExpiredStatuses.includes(error.status)) {
                setSessionExpired(true);
            }

            if (error.status === 404) {
                end('deleted');
            }

            if (error.status === 403) {
                end('ended');
            }
        } finally {
            if (request === latestRefetch.current) {
                flushBufferedActions();
            }
        }
    }, [retroId, end, flushBufferedActions]);

    const onEvent = useCallback(
        ({ name, payload }: RetroEvent) => {
            switch (name) {
                case 'card.created':
                case 'card.updated':
                    apply({
                        type: 'cards.upsert',
                        cards: [payload.card as CardPayload],
                    });
                    break;
                case 'card.deleted':
                    apply({
                        type: 'card.remove',
                        cardId: payload.cardId as string,
                        ungroupedCards: payload.ungroupedCards as CardPayload[],
                    });
                    break;
                case 'cards.moved':
                case 'card.grouped':
                case 'card.ungrouped':
                    apply({
                        type: 'cards.upsert',
                        cards: payload.cards as CardPayload[],
                    });
                    break;
                case 'vote.cast':
                case 'vote.retracted':
                    apply({
                        type: 'votes.cast',
                        votesCast: payload.votesCast as number,
                        votesVersion: payload.votesVersion as number,
                        cardId: payload.cardId as string | undefined,
                        total: payload.total as number | undefined,
                    });
                    break;
                case 'card.reactions.changed':
                    apply({
                        type: 'reactions.set',
                        cardId: payload.cardId as string,
                        reactions: payload.reactions as Array<
                            Omit<ReactionSummary, 'mine'>
                        >,
                    });
                    break;
                case 'comment.created':
                case 'comment.updated':
                    apply({
                        type: 'comment.upsert',
                        comment: payload.comment as CardComment,
                    });
                    break;
                case 'comment.deleted':
                    apply({
                        type: 'comment.remove',
                        cardId: payload.cardId as string,
                        commentId: payload.commentId as string,
                        soft: payload.soft as boolean,
                    });
                    break;
                case 'timer.changed':
                    apply({
                        type: 'timer.set',
                        timerEndsAt: payload.timerEndsAt as string | null,
                    });
                    break;
                case 'card.highlighted':
                    apply({
                        type: 'highlight.set',
                        cardId: payload.cardId as string | null,
                    });
                    break;
                case 'columns.changed':
                    apply({
                        type: 'columns.set',
                        columns: payload.columns as BoardColumn[],
                    });
                    break;
                case 'action-item.saved':
                    apply({
                        type: 'actionItem.upsert',
                        actionItem: payload.actionItem as ActionItem,
                    });
                    break;
                case 'action-item.deleted':
                    apply({
                        type: 'actionItem.remove',
                        actionItemId: payload.actionItemId as string,
                    });
                    break;
                case 'phase.changed':
                case 'settings.changed':
                    void refetch();
                    break;
                case 'retro.deleted':
                    end('deleted');
                    break;
            }
        },
        [apply, refetch, end],
    );

    const onJoining = useCallback(
        (member: PresenceMember) => {
            const isKnown = latestBoard.current.participants.some(
                (participant) => participant.id === member.id,
            );

            if (!isKnown) {
                void refetch();
            }
        },
        [refetch],
    );

    const onOwnCard = useCallback(
        (card: CardPayload) => apply({ type: 'cards.upsert', cards: [card] }),
        [apply],
    );

    const notifications = useCommentNotifications(retroId, board.cards);

    const onOwnComment = useCallback(
        (comment: CardComment) => apply({ type: 'comment.upsert', comment }),
        [apply],
    );

    const onCommentNotification = useCallback(
        (notification: CommentNotificationPayload) => {
            notifications.notify(notification.cardId);
            toast(
                notification.threadId === notification.commentId
                    ? t('New comment on your card')
                    : t('New reply in a thread you follow'),
                {
                    description: notification.authorName
                        ? `${notification.authorName}: ${notification.excerpt}`
                        : notification.excerpt,
                },
            );
        },
        [notifications.notify, t],
    );

    const { online, connected, reconnecting, presence } = useRetroChannel(
        retroId,
        initial.viewer.participantId,
        status === 'active',
        {
            onEvent,
            onResync: refetch,
            onJoining,
            onOwnCard,
            onOwnComment,
            onCommentNotification,
        },
    );

    const errorMessage = useCallback(
        (error: unknown): string => {
            if (!(error instanceof RetroRequestError)) {
                return t('Something went wrong. Please try again.');
            }

            if (error.status === 0) {
                return t(
                    'The server did not respond in time. Please try again.',
                );
            }

            return (
                error.message || t('Something went wrong. Please try again.')
            );
        },
        [t],
    );

    /**
     * Shows the session-expired banner for a 401/419 and returns null;
     * otherwise returns the translated message to show for the failure.
     */
    const handleError = useCallback(
        (error: unknown): string | null => {
            if (
                error instanceof RetroRequestError &&
                SessionExpiredStatuses.includes(error.status)
            ) {
                setSessionExpired(true);

                return null;
            }

            return errorMessage(error);
        },
        [errorMessage],
    );

    const run = useCallback(
        async <T>(mutation: Promise<T>): Promise<T | undefined> => {
            try {
                return await mutation;
            } catch (error) {
                const message = handleError(error);

                if (message === null) {
                    return undefined;
                }

                toast.error(message);
                await refetch();

                return undefined;
            }
        },
        [refetch, handleError],
    );

    /**
     * Reads the latest committed board rather than a render's copy, so
     * effect cleanups can tell why a card's component is going away.
     */
    const hasActiveCard = useCallback(
        (cardId: string): boolean =>
            isActive.current &&
            latestBoard.current.cards.some((card) => card.id === cardId),
        [],
    );

    return {
        board,
        dispatch,
        apply,
        refetch,
        status,
        online,
        connected,
        reconnecting,
        presence,
        unreadCardIds: notifications.unreadCardIds,
        markCommentsRead: notifications.markRead,
        run,
        handleError,
        hasActiveCard,
        sessionExpired,
    };
}
