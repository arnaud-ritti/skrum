import type { PresenceMember } from '@/lib/retro/types';
import { usePresenceChannel, type ChannelEvent } from './use-presence-channel';

const WhiteboardEvents = [
    'elements.changed',
    'timer.changed',
    'board.changed',
    'board.deleted',
] as const;

type WhiteboardChannelHandlers = {
    onEvent: (event: ChannelEvent<(typeof WhiteboardEvents)[number]>) => void;
    onResync: () => void;
    onLeaving?: (member: PresenceMember) => void;
};

export function useWhiteboardChannel(
    boardId: string,
    enabled: boolean,
    channelHandlers: WhiteboardChannelHandlers,
) {
    return usePresenceChannel(
        `whiteboard.${boardId}`,
        WhiteboardEvents,
        enabled,
        channelHandlers,
    );
}
