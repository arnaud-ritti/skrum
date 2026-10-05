import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { useSafeConnectionStatus } from '@/hooks/use-presence-channel';
import { realtimeState } from '@/lib/realtime/realtime-state';
import type { RealtimeState } from '@/lib/realtime/realtime-state';
import type {
    GameRoomSummary,
    TeamGameRoomChangedPayload,
    TeamGameRoomDeletedPayload,
} from '@/types';

function changedAt(room: GameRoomSummary): number {
    return room.updatedAt === null ? 0 : Date.parse(room.updatedAt);
}

/** The order of the server: a room in play first, then the latest changed. */
function byServerOrder(
    first: GameRoomSummary,
    second: GameRoomSummary,
): number {
    const playing =
        Number(second.status === 'playing') -
        Number(first.status === 'playing');

    return playing !== 0 ? playing : changedAt(second) - changedAt(first);
}

export function upsertTeamGameRoom(
    rooms: GameRoomSummary[],
    room: GameRoomSummary,
): GameRoomSummary[] {
    const others = rooms.filter((current) => current.id !== room.id);

    return [room, ...others].sort(byServerOrder);
}

export function removeTeamGameRoom(
    rooms: GameRoomSummary[],
    roomId: string,
): GameRoomSummary[] {
    if (!rooms.some((current) => current.id === roomId)) {
        return rooms;
    }

    return rooms.filter((current) => current.id !== roomId);
}

type TeamGamesChannelHandlers = {
    /** A round of a listed room has ended: its points are in the leaderboard. */
    onRoundEnded?: () => void;
    onRoomDeleted?: () => void;
    /** The channel is back after a drop: what happened meanwhile was not heard. */
    onResubscribed?: () => void;
};

/**
 * The rooms of a team, kept live by `private-team-games.{teamId}`: a room
 * created, changed or deleted elsewhere is added, replaced or removed here.
 */
export function useTeamGamesChannel(
    teamId: string,
    initialRooms: GameRoomSummary[],
    channelHandlers: TeamGamesChannelHandlers = {},
): { rooms: GameRoomSummary[]; realtime: RealtimeState } {
    const [rooms, setRooms] = useState(initialRooms);
    const [serverRooms, setServerRooms] = useState(initialRooms);
    const [subscribed, setSubscribed] = useState<string[]>([]);
    const connectionStatus = useSafeConnectionStatus();

    if (serverRooms !== initialRooms) {
        setServerRooms(initialRooms);
        setRooms(initialRooms);
    }

    const onResubscribed = useEffectEvent(() =>
        channelHandlers.onResubscribed?.(),
    );

    const onChanged = useEffectEvent((room: GameRoomSummary) => {
        const previous = rooms.find((current) => current.id === room.id);

        setRooms((current) => upsertTeamGameRoom(current, room));

        if (previous?.status === 'playing' && room.status === 'waiting') {
            channelHandlers.onRoundEnded?.();
        }
    });

    const onDeleted = useEffectEvent((roomId: string) => {
        setRooms((current) => removeTeamGameRoom(current, roomId));
        channelHandlers.onRoomDeleted?.();
    });

    useEffect(() => {
        if (!echoIsConfigured()) {
            return;
        }

        const name = `team-games.${teamId}`;
        let subscriptions = 0;

        echo<'reverb'>()
            .private(name)
            .subscribed(() => {
                subscriptions += 1;
                setSubscribed([name]);

                if (subscriptions > 1) {
                    onResubscribed();
                }
            })
            .listen(
                '.team.game-room.changed',
                ({ room }: TeamGameRoomChangedPayload) => onChanged(room),
            )
            .listen(
                '.team.game-room.deleted',
                ({ roomId }: TeamGameRoomDeletedPayload) => onDeleted(roomId),
            );

        return () => {
            echo().leave(name);
            setSubscribed([]);
        };
    }, [teamId]);

    return {
        rooms,
        realtime: realtimeState(connectionStatus === 'connected', subscribed),
    };
}
