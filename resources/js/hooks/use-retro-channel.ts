import {
    echo,
    echoIsConfigured,
    type ConnectionStatus,
} from '@laravel/echo-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type {
    CardComment,
    CardPayload,
    CommentNotificationPayload,
    PresenceMember,
    SurveyComment,
} from '@/lib/retro/types';
import type { GameEvent, GameEventName } from './use-game-channel';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';

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

/**
 * The presence and private subscriptions complete moments apart (on load
 * and on every reconnect); waiting briefly lets one snapshot cover both.
 */
const ResyncCoalesceMs = 250;

type RetroEventName =
    | (typeof RetroEvents)[number]
    | (typeof MemberEvents)[number];

export type RetroEvent = {
    name: RetroEventName;
    payload: Record<string, unknown>;
};

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

function subscribeToConnection(onChange: () => void): () => void {
    if (!echoIsConfigured()) {
        return () => {};
    }

    return echo().connector.onConnectionChange(onChange);
}

function connectionStatus(): ConnectionStatus {
    if (!echoIsConfigured()) {
        return 'connecting';
    }

    return echo().connector.connectionStatus();
}

function serverConnectionStatus(): ConnectionStatus {
    return 'connecting';
}

/**
 * SSR-safe replacement for echo-react's useConnectionStatus, which calls
 * echo() during render and would throw on the server.
 */
export function useSafeConnectionStatus(): ConnectionStatus {
    return useSyncExternalStore(
        subscribeToConnection,
        connectionStatus,
        serverConnectionStatus,
    );
}

export function useRetroChannel(
    retroId: string,
    participantId: string,
    enabled: boolean,
    membersOnly: boolean,
    channelHandlers: RetroChannelHandlers,
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const [presence, setPresence] = useState<WhisperChannel | null>(null);
    const status = useSafeConnectionStatus();
    const handlers = useRef(channelHandlers);
    const [wasConnected, setWasConnected] = useState(false);

    handlers.current = channelHandlers;

    if (status === 'connected' && !wasConnected) {
        setWasConnected(true);
    }

    useEffect(() => {
        if (!enabled || !echoIsConfigured()) {
            return;
        }

        let pendingResync: ReturnType<typeof setTimeout> | null = null;

        const scheduleResync = () => {
            if (pendingResync !== null) {
                return;
            }

            pendingResync = setTimeout(() => {
                pendingResync = null;
                handlers.current.onResync();
            }, ResyncCoalesceMs);
        };

        const name = `retro.${retroId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(members);
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => [
                    ...current.filter((m) => m.id !== member.id),
                    member,
                ]);
                handlers.current.onJoining(member);
            })
            .leaving((member: PresenceMember) =>
                setOnline((current) =>
                    current.filter((m) => m.id !== member.id),
                ),
            )
            .error(scheduleResync);

        setPresence(channel as unknown as WhisperChannel);

        for (const event of RetroEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onEvent({ name: event, payload }),
            );
        }

        for (const event of handlers.current.gameEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onGameEvent({ name: event, payload }),
            );
        }

        const ownChannel = `participant.${participantId}`;

        echo<'reverb'>()
            .private(ownChannel)
            .subscribed(scheduleResync)
            .listen('.own-card.saved', (payload: { card: CardPayload }) =>
                handlers.current.onOwnCard(payload.card),
            )
            .listen('.own-comment.saved', (payload: { comment: CardComment }) =>
                handlers.current.onOwnComment(payload.comment),
            )
            .listen(
                '.own-survey-comment.saved',
                (payload: { comment: SurveyComment }) =>
                    handlers.current.onOwnSurveyComment(payload.comment),
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
                        handlers.current.onEvent({ name: event, payload }),
                );
            }
        }

        return () => {
            if (pendingResync !== null) {
                clearTimeout(pendingResync);
            }

            echo().leave(name);
            echo().leave(ownChannel);

            if (membersOnly) {
                echo().leave(membersChannel);
            }
            setOnline([]);
            setPresence(null);
        };
    }, [retroId, participantId, enabled, membersOnly]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence };
}
