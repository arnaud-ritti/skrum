import { echo } from '@laravel/echo-react';
import { useRef } from 'react';
import type {
    CardComment,
    CardPayload,
    CommentNotificationPayload,
    PresenceMember,
    SurveyComment,
} from '@/lib/retro/types';
import type { GameEvent, GameEventName } from './use-game-channel';
import { usePresenceChannel, type ChannelEvent } from './use-presence-channel';

const RetroEvents = [
    'card.created',
    'card.updated',
    'card.deleted',
    'cards.moved',
    'card.grouped',
    'card.ungrouped',
    'vote.cast',
    'vote.retracted',
    'phase.changed',
    'timer.changed',
    'card.highlighted',
    'settings.changed',
    'columns.changed',
    'action-item.saved',
    'action-item.deleted',
    'action-item.comments.changed',
    'retro.deleted',
    'card.reactions.changed',
    'comment.created',
    'comment.updated',
    'comment.deleted',
    'health.answered',
    'survey.changed',
    'survey.deleted',
    'survey.discussion.changed',
    'card.group-named',
    'roti.changed',
    'results.changed',
    'insights.changed',
    'voting.finished',
    'writing.count',
    'topic.discussed',
    'topic.note.saved',
    'roti.revealed',
    'roti.nudged',
] as const;

/**
 * Carried action items of earlier retros travel on a private channel only
 * members can join (spec §5).
 */
const MemberEvents = [
    'carried-action-item.saved',
    'carried-action-item.removed',
    'carried-action-item.comments.changed',
    'action-item.external-links.changed',
] as const;

type RetroEventName =
    | (typeof RetroEvents)[number]
    | (typeof MemberEvents)[number];

export type RetroEvent = ChannelEvent<RetroEventName>;

type RetroChannelHandlers = {
    onEvent: (event: RetroEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
    onOwnCard: (card: CardPayload) => void;
    onOwnComment: (comment: CardComment) => void;
    onOwnSurveyComment: (comment: SurveyComment) => void;
    onCommentNotification: (notification: CommentNotificationPayload) => void;
    /** The icebreaker's game events travel on the retro channel (spec §6). */
    gameEvents: readonly GameEventName[];
    onGameEvent: (event: GameEvent) => void;
};

export function useRetroChannel(
    retroId: string,
    participantId: string,
    enabled: boolean,
    membersOnly: boolean,
    channelHandlers: RetroChannelHandlers,
) {
    const handlers = useRef(channelHandlers);

    handlers.current = channelHandlers;

    return usePresenceChannel(
        `retro.${retroId}`,
        RetroEvents,
        enabled,
        {
            ...channelHandlers,
            subscribe: (channel, scheduleResync) => {
                for (const event of handlers.current.gameEvents) {
                    channel.listen(
                        `.${event}`,
                        (payload: Record<string, unknown>) =>
                            handlers.current.onGameEvent({
                                name: event,
                                payload,
                            }),
                    );
                }

                const ownChannel = `participant.${participantId}`;

                echo<'reverb'>()
                    .private(ownChannel)
                    .subscribed(scheduleResync)
                    .listen(
                        '.own-card.saved',
                        (payload: { card: CardPayload }) =>
                            handlers.current.onOwnCard(payload.card),
                    )
                    .listen(
                        '.own-comment.saved',
                        (payload: { comment: CardComment }) =>
                            handlers.current.onOwnComment(payload.comment),
                    )
                    .listen(
                        '.own-survey-comment.saved',
                        (payload: { comment: SurveyComment }) =>
                            handlers.current.onOwnSurveyComment(
                                payload.comment,
                            ),
                    )
                    .listen(
                        '.comment.notification',
                        (payload: CommentNotificationPayload) =>
                            handlers.current.onCommentNotification(payload),
                    )
                    .error(scheduleResync);

                const membersChannel = `retro-members.${retroId}`;

                if (membersOnly) {
                    const members = echo<'reverb'>()
                        .private(membersChannel)
                        .subscribed(scheduleResync)
                        .error(scheduleResync);

                    for (const event of MemberEvents) {
                        members.listen(
                            `.${event}`,
                            (payload: Record<string, unknown>) =>
                                handlers.current.onEvent({
                                    name: event,
                                    payload,
                                }),
                        );
                    }
                }

                return () => {
                    echo().leave(ownChannel);

                    if (membersOnly) {
                        echo().leave(membersChannel);
                    }
                };
            },
        },
        `${participantId}:${membersOnly}`,
    );
}
