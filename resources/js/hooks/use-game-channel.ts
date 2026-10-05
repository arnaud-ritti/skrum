import { useState } from 'react';
import type { PresenceMember } from '@/lib/retro/types';
import { usePresenceChannel, type ChannelEvent } from './use-presence-channel';

/** Every event a game room broadcasts. */
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

export type GameEventName = (typeof GameEvents)[number];

export type GameEvent = ChannelEvent<GameEventName>;

type GameChannelHandlers = {
    onEvent: (event: GameEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
};

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
    const [full, setFull] = useState(false);
    const channel = usePresenceChannel(`game.${roomId}`, GameEvents, enabled, {
        ...channelHandlers,
        onHere: () => setFull(false),
        onError: (error) => {
            if (!isRoomFull(error)) {
                return false;
            }

            setFull(true);

            return true;
        },
        subscribe: () => {
            setFull(false);

            return () => {};
        },
    });

    return { ...channel, full };
}
