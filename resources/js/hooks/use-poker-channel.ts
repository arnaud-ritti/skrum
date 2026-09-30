import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import type { PresenceMember } from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/retro/whisper-transport';
import { useSafeConnectionStatus } from './use-retro-channel';

export const PokerEvents = [
    'task.saved',
    'task.deleted',
    'tasks.reordered',
    'vote.changed',
    'round.changed',
    'game.changed',
    'game.deleted',
] as const;

/**
 * The presence subscription completes moments after the socket (on load
 * and on every reconnect); waiting briefly lets one snapshot cover both.
 */
const ResyncCoalesceMs = 250;

export type PokerEventName = (typeof PokerEvents)[number];

export type PokerEvent = {
    name: PokerEventName;
    payload: Record<string, unknown>;
};

export type PokerChannelHandlers = {
    onEvent: (event: PokerEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
};

/** A player open in two tabs is one presence member with the same id. */
function withMember(
    members: PresenceMember[],
    member: PresenceMember,
): PresenceMember[] {
    return [...members.filter((known) => known.id !== member.id), member];
}

function uniqueMembers(members: PresenceMember[]): PresenceMember[] {
    return members.reduce<PresenceMember[]>(withMember, []);
}

export function usePokerChannel(
    gameId: string,
    enabled: boolean,
    channelHandlers: PokerChannelHandlers,
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

        const name = `poker.${gameId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(uniqueMembers(members));
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => withMember(current, member));
                handlers.current.onJoining(member);
            })
            .leaving((member: PresenceMember) =>
                setOnline((current) =>
                    current.filter((known) => known.id !== member.id),
                ),
            )
            .error(scheduleResync);

        setPresence(channel as unknown as WhisperChannel);

        for (const event of PokerEvents) {
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
    }, [gameId, enabled]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence };
}
