import {
    echo,
    echoIsConfigured,
    type ConnectionStatus,
} from '@laravel/echo-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PresenceMember } from '@/lib/retro/types';

export const RetroEvents = [
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
    'retro.deleted',
] as const;

export type RetroEventName = (typeof RetroEvents)[number];

export type RetroEvent = {
    name: RetroEventName;
    payload: Record<string, unknown>;
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
    enabled: boolean,
    onEvent: (event: RetroEvent) => void,
    onResync: () => void,
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const status = useSafeConnectionStatus();
    const handlers = useRef({ onEvent, onResync });
    const [wasConnected, setWasConnected] = useState(false);

    handlers.current = { onEvent, onResync };

    if (status === 'connected' && !wasConnected) {
        setWasConnected(true);
    }

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const name = `retro.${retroId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(members);
                handlers.current.onResync();
            })
            .joining((member: PresenceMember) =>
                setOnline((current) => [
                    ...current.filter((m) => m.id !== member.id),
                    member,
                ]),
            )
            .leaving((member: PresenceMember) =>
                setOnline((current) =>
                    current.filter((m) => m.id !== member.id),
                ),
            );

        for (const event of RetroEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onEvent({ name: event, payload }),
            );
        }

        return () => {
            echo().leave(name);
            setOnline([]);
        };
    }, [retroId, enabled]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting };
}
