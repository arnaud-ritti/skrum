import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import { useSafeConnectionStatus } from '@/hooks/use-retro-channel';
import { realtimeState } from '@/lib/realtime/realtime-state';
import type { RealtimeState } from '@/lib/realtime/realtime-state';
import type {
    GameRoomSummary,
    TeamGameRoomChangedPayload,
    TeamGameRoomDeletedPayload,
} from '@/types';

export function upsertTeamGameRoom(
    rooms: GameRoomSummary[],
    room: GameRoomSummary,
): GameRoomSummary[] {
    if (!rooms.some((current) => current.id === room.id)) {
        return [room, ...rooms];
    }

    return rooms.map((current) => (current.id === room.id ? room : current));
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

export type TeamGamesChannelHandlers = {
    /** A round of a listed room has ended: its points are in the leaderboard. */
    onRoundEnded?: () => void;
    onRoomDeleted?: () => void;
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
    const handlers = useRef(channelHandlers);
    const latestRooms = useRef(rooms);

    handlers.current = channelHandlers;
    latestRooms.current = rooms;

    if (serverRooms !== initialRooms) {
        setServerRooms(initialRooms);
        setRooms(initialRooms);
    }

    useEffect(() => {
        if (!echoIsConfigured()) {
            return;
        }

        const name = `team-games.${teamId}`;

        echo<'reverb'>()
            .private(name)
            .subscribed(() => setSubscribed([name]))
            .listen(
                '.team.game-room.changed',
                ({ room }: TeamGameRoomChangedPayload) => {
                    const previous = latestRooms.current.find(
                        (current) => current.id === room.id,
                    );

                    setRooms((current) => upsertTeamGameRoom(current, room));

                    if (
                        previous?.status === 'playing' &&
                        room.status === 'waiting'
                    ) {
                        handlers.current.onRoundEnded?.();
                    }
                },
            )
            .listen(
                '.team.game-room.deleted',
                ({ roomId }: TeamGameRoomDeletedPayload) => {
                    setRooms((current) => removeTeamGameRoom(current, roomId));
                    handlers.current.onRoomDeleted?.();
                },
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
