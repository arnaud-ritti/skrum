import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';
import { useSafeConnectionStatus } from './use-retro-channel';

/** Plans 13b and 13c append their event names here. */
export const GameEvents = [
    'game.room.changed',
    'game.room.deleted',
    'game.timer.changed',
    'game.round.started',
    'game.round.ended',
    'game.letter.picked',
    'game.hint.revealed',
    'game.guess.made',
    'game.drawing.op-added',
    'game.drawing.undone',
    'game.drawing.cleared',
    'game.clue.changed',
    'game.question.changed',
    'game.answer.changed',
    'game.round.revealed',
    'game.vote.changed',
    'game.turn.changed',
    'game.statements.changed',
    'game.votes.counted',
    'game.word.found',
    'game.word.changed',
] as const;

/**
 * The presence subscription completes moments after the socket (on load
 * and on every reconnect); waiting briefly lets one snapshot cover both.
 */
const ResyncCoalesceMs = 250;

export type GameEventName = (typeof GameEvents)[number];

export type GameEvent = {
    name: GameEventName;
    payload: Record<string, unknown>;
};

type GameChannelHandlers = {
    onEvent: (event: GameEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
};

function withMember(
    members: PresenceMember[],
    member: PresenceMember,
): PresenceMember[] {
    return [...members.filter((known) => known.id !== member.id), member];
}

/**
 * The channel authorization answers 409 when twelve players are online; a
 * 403 (room gone, access lost) goes through the snapshot like any refusal.
 */
function isRoomFull(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status: unknown }).status === 409
    );
}

export function useGameChannel(
    roomId: string,
    enabled: boolean,
    channelHandlers: GameChannelHandlers,
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const [presence, setPresence] = useState<WhisperChannel | null>(null);
    const [full, setFull] = useState(false);
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

        setFull(false);

        const scheduleResync = () => {
            if (pendingResync !== null) {
                return;
            }

            pendingResync = setTimeout(() => {
                pendingResync = null;
                handlers.current.onResync();
            }, ResyncCoalesceMs);
        };

        const name = `game.${roomId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setFull(false);
                setOnline(members.reduce<PresenceMember[]>(withMember, []));
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => withMember(current, member));
                handlers.current.onJoining(member);
            })
            .leaving((member: PresenceMember) => {
                setOnline((current) =>
                    current.filter((known) => known.id !== member.id),
                );
            })
            .error((error: unknown) => {
                if (isRoomFull(error)) {
                    setFull(true);

                    return;
                }

                scheduleResync();
            });

        setPresence(channel as unknown as WhisperChannel);

        for (const event of GameEvents) {
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
    }, [roomId, enabled]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence, full };
}
