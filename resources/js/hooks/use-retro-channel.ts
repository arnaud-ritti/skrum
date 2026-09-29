import { echo, useConnectionStatus } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
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

export function useRetroChannel(
    retroId: string,
    enabled: boolean,
    onEvent: (event: RetroEvent) => void,
    onResync: () => void,
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const status = useConnectionStatus();
    const handlers = useRef({ onEvent, onResync });
    const wasConnected = useRef(false);

    handlers.current = { onEvent, onResync };

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const name = `retro.${retroId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => setOnline(members))
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

    useEffect(() => {
        if (status !== 'connected') {
            return;
        }

        if (wasConnected.current) {
            handlers.current.onResync();
        }

        wasConnected.current = true;
    }, [status]);

    return { online, connected: status === 'connected' };
}
