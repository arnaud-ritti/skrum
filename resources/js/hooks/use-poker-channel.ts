import type { PresenceMember } from '@/lib/retro/types';
import { usePresenceChannel, type ChannelEvent } from './use-presence-channel';

const PokerEvents = [
    'task.saved',
    'task.deleted',
    'tasks.reordered',
    'vote.changed',
    'round.changed',
    'game.changed',
    'game.deleted',
    'timer.changed',
] as const;

export type PokerEvent = ChannelEvent<(typeof PokerEvents)[number]>;

type PokerChannelHandlers = {
    onEvent: (event: PokerEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
    onLeaving?: (member: PresenceMember) => void;
};

export function usePokerChannel(
    gameId: string,
    enabled: boolean,
    channelHandlers: PokerChannelHandlers,
) {
    return usePresenceChannel(
        `poker.${gameId}`,
        PokerEvents,
        enabled,
        channelHandlers,
    );
}
