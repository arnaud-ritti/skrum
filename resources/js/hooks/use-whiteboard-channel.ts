import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';
import { useSafeConnectionStatus } from './use-retro-channel';

const WhiteboardEvents = [
    'elements.changed',
    'timer.changed',
    'board.changed',
    'board.deleted',
] as const;

/**
 * The presence subscription completes moments after the socket (on load
 * and on every reconnect); waiting briefly lets one resync cover both.
 */
const ResyncCoalesceMs = 250;

type WhiteboardEventName = (typeof WhiteboardEvents)[number];

type WhiteboardEvent = {
    name: WhiteboardEventName;
    payload: Record<string, unknown>;
};

type WhiteboardChannelHandlers = {
    onEvent: (event: WhiteboardEvent) => void;
    onResync: () => void;
    onLeaving?: (member: PresenceMember) => void;
};

/** A member open in two tabs is one presence member with the same id. */
function withMember(
    members: PresenceMember[],
    member: PresenceMember,
): PresenceMember[] {
    return [...members.filter((known) => known.id !== member.id), member];
}

export function useWhiteboardChannel(
    boardId: string,
    enabled: boolean,
    channelHandlers: WhiteboardChannelHandlers,
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

        const name = `whiteboard.${boardId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(members.reduce<PresenceMember[]>(withMember, []));
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => withMember(current, member));
            })
            .leaving((member: PresenceMember) => {
                setOnline((current) =>
                    current.filter((known) => known.id !== member.id),
                );
                handlers.current.onLeaving?.(member);
            })
            .error(scheduleResync);

        setPresence(channel as unknown as WhisperChannel);

        for (const event of WhiteboardEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onEvent({ name: event, payload }),
            );
        }

        return () => {
            if (pendingResync !== null) {
                clearTimeout(pendingResync);
            }

            echo().leave(name);
            setOnline([]);
            setPresence(null);
        };
    }, [boardId, enabled]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence };
}
