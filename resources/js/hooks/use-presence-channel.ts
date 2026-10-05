import {
    echo,
    echoIsConfigured,
    type ConnectionStatus,
} from '@laravel/echo-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';

/**
 * The presence subscription completes moments after the socket (on load
 * and on every reconnect), and moments apart from any private channel
 * joined beside it; waiting briefly lets one snapshot cover them all.
 */
const ResyncCoalesceMs = 250;

export type ChannelEvent<Name extends string> = {
    name: Name;
    payload: Record<string, unknown>;
};

type PresenceChannel = ReturnType<ReturnType<typeof echo<'reverb'>>['join']>;

type PresenceChannelHandlers<Name extends string> = {
    onEvent: (event: ChannelEvent<Name>) => void;
    onResync: () => void;
    onHere?: () => void;
    onJoining?: (member: PresenceMember) => void;
    onLeaving?: (member: PresenceMember) => void;
    /** True when the refusal is handled, so no resync follows it. */
    onError?: (error: unknown) => boolean;
    /** Further subscriptions made with the presence channel; returns what leaves them. */
    subscribe?: (
        channel: PresenceChannel,
        scheduleResync: () => void,
    ) => () => void;
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

/** A member open in two tabs is one presence member with the same id. */
function withMember(
    members: PresenceMember[],
    member: PresenceMember,
): PresenceMember[] {
    return [...members.filter((known) => known.id !== member.id), member];
}

/**
 * Joins the presence channel `name` while `enabled`, relays its `events`
 * and asks for a resync once it is (re)subscribed or refused. A change of
 * `subscriptionKey` joins again, for subscriptions that depend on it.
 */
export function usePresenceChannel<Name extends string>(
    name: string,
    events: readonly Name[],
    enabled: boolean,
    channelHandlers: PresenceChannelHandlers<Name>,
    subscriptionKey = '',
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const [presence, setPresence] = useState<WhisperChannel | null>(null);
    const status = useSafeConnectionStatus();
    const handlers = useRef(channelHandlers);
    const eventNames = useRef(events);
    const [wasConnected, setWasConnected] = useState(false);

    handlers.current = channelHandlers;
    eventNames.current = events;

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

        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                handlers.current.onHere?.();
                setOnline(members.reduce<PresenceMember[]>(withMember, []));
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => withMember(current, member));
                handlers.current.onJoining?.(member);
            })
            .leaving((member: PresenceMember) => {
                setOnline((current) =>
                    current.filter((known) => known.id !== member.id),
                );
                handlers.current.onLeaving?.(member);
            })
            .error((error: unknown) => {
                if (handlers.current.onError?.(error) === true) {
                    return;
                }

                scheduleResync();
            });

        setPresence(channel as unknown as WhisperChannel);

        for (const event of eventNames.current) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onEvent({ name: event, payload }),
            );
        }

        const leaveSubscriptions = handlers.current.subscribe?.(
            channel,
            scheduleResync,
        );

        return () => {
            if (pendingResync !== null) {
                clearTimeout(pendingResync);
            }

            echo().leave(name);
            leaveSubscriptions?.();
            setOnline([]);
            setPresence(null);
        };
    }, [name, enabled, subscriptionKey]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence };
}
