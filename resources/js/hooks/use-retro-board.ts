import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import RetroSnapshotsController from '@/actions/App/Http/Controllers/Retros/RetroSnapshotsController';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    boardReducer,
    seedTotalVersions,
    type BoardAction,
} from '@/lib/retro/board-reducer';
import {
    createSurveyRefetcher,
    needsSurveyRefetch,
    type SurveyRefetcher,
} from '@/lib/retro/survey-api';
import type {
    ActionItem,
    BoardColumn,
    CardComment,
    CardPayload,
    CommentNotificationPayload,
    PresenceMember,
    ReactionSummary,
    Snapshot,
    SurveyComment,
    TopicNote,
} from '@/lib/retro/types';
import type { ExternalLink } from '@/types/integrations';
import { GameEvents, type GameEvent } from './use-game-channel';
import { useCommentNotifications } from './use-comment-notifications';
import { useRetroChannel, type RetroEvent } from './use-retro-channel';

const SessionExpiredStatuses = [401, 419];
const DebouncedRefetchMs = 1_000;

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
    const surveyRefetcher = useRef<SurveyRefetcher | null>(null);
    const gameListeners = useRef(new Set<(event: GameEvent) => void>());
    const rotiNudgeListeners = useRef(new Set<() => void>());
    const writingCountListeners = useRef(new Set<(count: number) => void>());
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

    const pendingRefetch = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Several viewers rating or a summary finishing produce bursts of
     * events; one snapshot a second later covers them all.
     */
    const scheduleRefetch = useCallback(() => {
        if (pendingRefetch.current !== null) {
            return;
        }

        pendingRefetch.current = setTimeout(() => {
            pendingRefetch.current = null;
            void refetch();
        }, DebouncedRefetchMs);
    }, [refetch]);

    useEffect(
        () => () => {
            if (pendingRefetch.current !== null) {
                clearTimeout(pendingRefetch.current);
            }
        },
        [],
    );

    const onEvent = useCallback(
        ({ name, payload }: RetroEvent) => {
            switch (name) {
                case 'card.created':
                case 'card.updated':
                    apply({
                        type: 'cards.upsert',
                        cards: [payload.card as CardPayload],
                    });

                    if (typeof payload.writersCount === 'number') {
                        apply({
                            type: 'writers.set',
                            writersCount: payload.writersCount,
                        });
                    }
                    break;
                case 'card.deleted':
                    apply({
                        type: 'card.remove',
                        cardId: payload.cardId as string,
                        ungroupedCards: payload.ungroupedCards as CardPayload[],
                    });

                    if (typeof payload.writersCount === 'number') {
                        apply({
                            type: 'writers.set',
                            writersCount: payload.writersCount,
                        });
                    }
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
                        timerPausedSeconds: payload.timerPausedSeconds as
                            | number
                            | null,
                        topicSeconds: payload.topicSeconds as number | null,
                    });
                    break;
                case 'voting.finished':
                    apply({
                        type: 'voting.finished',
                        finishedIds: payload.finishedIds as string[],
                    });
                    break;
                case 'topic.discussed':
                    apply({
                        type: 'topic.discussed',
                        cardId: payload.cardId as string,
                        discussedAt: payload.discussedAt as string | null,
                    });
                    break;
                case 'topic.note.saved':
                    apply({
                        type: 'topicNote.set',
                        note: payload.note as TopicNote,
                    });
                    break;
                case 'roti.revealed':
                    void refetch();
                    break;
                case 'roti.nudged':
                    for (const listener of rotiNudgeListeners.current) {
                        listener();
                    }
                    break;
                case 'writing.count':
                    for (const listener of writingCountListeners.current) {
                        listener(payload.count as number);
                    }
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
                case 'action-item.comments.changed':
                case 'carried-action-item.comments.changed':
                    apply({
                        type: 'actionItem.comments',
                        actionItemId: payload.actionItemId as string,
                        commentCount: payload.commentCount as number,
                        refresh: true,
                    });
                    break;
                case 'carried-action-item.saved':
                    apply({
                        type: 'carriedActionItem.upsert',
                        actionItem: payload.actionItem as ActionItem,
                    });
                    break;
                case 'carried-action-item.removed':
                    apply({
                        type: 'carriedActionItem.remove',
                        actionItemId: payload.actionItemId as string,
                    });
                    break;
                case 'action-item.external-links.changed':
                    apply({
                        type: 'actionItem.externalLinks',
                        actionItemId: payload.actionItemId as string,
                        externalLinks: payload.externalLinks as ExternalLink[],
                    });
                    break;
                case 'health.answered':
                    apply({
                        type: 'health.progress',
                        respondents: payload.respondents as number,
                        participants: payload.participants as number,
                    });
                    break;
                case 'survey.changed': {
                    const surveyId = payload.surveyId as string;
                    const local = latestBoard.current.surveys.find(
                        (survey) => survey.id === surveyId,
                    );

                    apply({
                        type: 'survey.counts',
                        surveyId,
                        responseCount: payload.responseCount as number,
                    });

                    if (needsSurveyRefetch(local, payload.version as number)) {
                        surveyRefetcher.current?.schedule(surveyId);
                    }

                    break;
                }
                case 'survey.deleted':
                    surveyRefetcher.current?.invalidate(
                        payload.surveyId as string,
                    );
                    apply({
                        type: 'survey.remove',
                        surveyId: payload.surveyId as string,
                    });
                    break;
                case 'survey.discussion.changed': {
                    const surveyId = payload.surveyId as string;

                    apply({
                        type: 'survey.counts',
                        surveyId,
                        commentCount: payload.commentCount as number,
                    });

                    if (
                        latestBoard.current.surveys.find(
                            (survey) => survey.id === surveyId,
                        )?.resultsVisible
                    ) {
                        surveyRefetcher.current?.schedule(surveyId);
                    }

                    break;
                }
                case 'card.group-named':
                    apply({
                        type: 'card.groupName',
                        cardId: payload.cardId as string,
                        groupName: payload.groupName as string | null,
                    });
                    break;
                case 'roti.changed':
                    apply({
                        type: 'roti.set',
                        respondents: payload.respondents as number,
                        voterIds: payload.voterIds as string[],
                    });

                    if (latestBoard.current.retro.phase === 'completed') {
                        scheduleRefetch();
                    }
                    break;
                case 'insights.changed':
                case 'results.changed':
                    scheduleRefetch();
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
        [apply, refetch, end, scheduleRefetch],
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

    const invalidateSurvey = useCallback(
        (surveyId: string) => surveyRefetcher.current?.invalidate(surveyId),
        [],
    );

    const onOwnSurveyComment = useCallback(
        (comment: SurveyComment) =>
            surveyRefetcher.current?.schedule(comment.surveyId),
        [],
    );

    const onCommentNotification = useCallback(
        (notification: CommentNotificationPayload) => {
            if (notification.cardId) {
                notifications.notify(notification.cardId);
            }

            const isReply = notification.threadId !== notification.commentId;
            const title = isReply
                ? t('New reply in a thread you follow')
                : notification.surveyId
                  ? t('New comment on your survey')
                  : t('New comment on your card');

            toast(title, {
                description: notification.authorName
                    ? `${notification.authorName}: ${notification.excerpt}`
                    : notification.excerpt,
            });
        },
        [notifications.notify, t],
    );

    /** The icebreaker panel subscribes while it is mounted. */
    const subscribeGameEvents = useCallback(
        (listener: (event: GameEvent) => void) => {
            gameListeners.current.add(listener);

            return () => {
                gameListeners.current.delete(listener);
            };
        },
        [],
    );

    /** The ROTI screen pulses for the voters left while it is mounted. */
    const subscribeRotiNudges = useCallback((listener: () => void) => {
        rotiNudgeListeners.current.add(listener);

        return () => {
            rotiNudgeListeners.current.delete(listener);
        };
    }, []);

    /**
     * How many write on an anonymous retro: transient, so it never enters
     * the snapshot.
     */
    const subscribeWritingCount = useCallback(
        (listener: (count: number) => void) => {
            writingCountListeners.current.add(listener);

            return () => {
                writingCountListeners.current.delete(listener);
            };
        },
        [],
    );

    const onGameEvent = useCallback((event: GameEvent) => {
        for (const listener of gameListeners.current) {
            listener(event);
        }
    }, []);

    const { online, connected, reconnecting, presence } = useRetroChannel(
        retroId,
        initial.viewer.participantId,
        status === 'active',
        !initial.viewer.isGuest,
        {
            onEvent,
            onResync: refetch,
            onJoining,
            onOwnCard,
            onOwnComment,
            onOwnSurveyComment,
            onCommentNotification,
            gameEvents: GameEvents,
            onGameEvent,
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

    useEffect(() => {
        const refetcher = createSurveyRefetcher(retroId, {
            onSurvey: (survey) => {
                if (isActive.current) {
                    apply({ type: 'survey.upsert', survey });
                }
            },
            onGone: (surveyId) => {
                if (isActive.current) {
                    apply({ type: 'survey.remove', surveyId });
                }
            },
            onError: (error) => {
                handleError(error);
            },
        });

        surveyRefetcher.current = refetcher;

        return () => {
            refetcher.cancel();
            surveyRefetcher.current = null;
        };
    }, [retroId, apply, handleError]);

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
        invalidateSurvey,
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
        subscribeGameEvents,
        subscribeRotiNudges,
        subscribeWritingCount,
    };
}
