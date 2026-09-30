import { ConnectionBanner } from '@/components/retro/connection-banner';
import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
import { useGameRoom } from '@/hooks/use-game-room';
import type { GameSnapshot } from '@/lib/games/types';
import { GamePanel } from './game-panel';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomFull } from './room-full';
import { RoomGone } from './room-gone';
import { RoomHeader } from './room-header';

export function GameRoom({ snapshot: initial }: { snapshot: GameSnapshot }) {
    const room = useGameRoom(initial, { subscribe: true });

    if (room.full) {
        return <RoomFull />;
    }

    if (room.status !== 'active') {
        return (
            <RoomGone
                reason={room.status}
                teamUrl={room.state.snapshot.links.team}
            />
        );
    }

    const ctx: RoomContextValue = {
        snapshot: room.state.snapshot,
        lastEnded: room.state.lastEnded,
        dispatch: room.dispatch,
        apply: room.apply,
        run: room.run,
        handleError: room.handleError,
        refetch: room.refetch,
        online: room.online,
        presence: room.presence,
        serverOffset: room.serverOffset,
        sessionExpired: room.sessionExpired,
    };

    return (
        <RoomProvider value={ctx}>
            <div className="flex min-h-dvh flex-col">
                {room.sessionExpired && <SessionExpiredBanner />}
                <div
                    className="flex flex-1 flex-col"
                    inert={room.sessionExpired}
                >
                    <RoomHeader />
                    <ConnectionBanner reconnecting={room.reconnecting} />
                    <GamePanel />
                </div>
            </div>
        </RoomProvider>
    );
}
