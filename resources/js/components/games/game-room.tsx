import type { ReactNode } from 'react';
import { SessionPresence } from '@/components/session/session-presence';
import { SessionReactions } from '@/components/session/session-reactions';
import { SessionShell } from '@/components/session/session-shell';
import { avatarOrigin } from '@/components/session/use-flying-reactions';
import { useGameRoom } from '@/hooks/use-game-room';
import { useIsMobile } from '@/hooks/use-mobile';
import type { GameSnapshot } from '@/lib/games/types';
import { realtimeState } from '@/lib/realtime/realtime-state';
import { GameLayout } from './game-layout';
import { GameStage } from './game-stage';
import { PlayerChips } from './player-chips';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomFull } from './room-full';
import { RoomGone } from './room-gone';
import { RoomActions, RoomTimer, RoomTitle } from './room-header';
import { useRoomPanels } from './room-panels';

type GameRoomProps = {
    snapshot: GameSnapshot;
    /** Places left for later features; nothing fills them today. */
    gifCaption?: ReactNode;
    gifPodium?: ReactNode;
};

const reactionBarClass =
    'rounded-full border border-border bg-popover shadow-raised';

export function GameRoom({
    snapshot: initial,
    gifCaption,
    gifPodium,
}: GameRoomProps) {
    const room = useGameRoom(initial, { subscribe: true });
    const isMobile = useIsMobile();
    const panels = useRoomPanels({
        snapshot: room.state.snapshot,
        lastEnded: room.state.lastEnded,
        gifCaption,
        gifPodium,
    });

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

    const { snapshot, lastEnded } = room.state;
    const { players, round } = snapshot;
    const me = players.find((player) => player.id === snapshot.me.playerId);
    const host = players.find(
        (player) => player.id === snapshot.room.hostPlayerId,
    );
    /** Digits and letters belong to the game while its keyboard or a guess field is on screen. */
    const isTyping = round !== null && round.game !== 'gif';

    const ctx: RoomContextValue = {
        snapshot,
        lastEnded,
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

    const canReact =
        snapshot.room.reactionsEnabled &&
        room.presence !== null &&
        me !== undefined;

    return (
        <RoomProvider value={ctx}>
            <SessionShell
                kind="game"
                self={
                    me
                        ? {
                              name: me.name,
                              avatarUrl: me.avatarUrl,
                              isGuest: me.isGuest,
                          }
                        : null
                }
                title={<RoomTitle />}
                timer={<RoomTimer />}
                presence={
                    <SessionPresence
                        online={room.online}
                        selfId={me?.presenceId ?? null}
                        facilitatorId={host?.presenceId}
                        className="shrink-0 flex-nowrap"
                    />
                }
                actions={<RoomActions />}
                realtime={realtimeState(room.connected, room.online)}
                connection={{
                    reconnecting: room.reconnecting,
                    expired: room.sessionExpired,
                }}
            >
                <GameLayout
                    {...panels}
                    stage={<GameStage gifCaption={gifCaption} />}
                    summary={<PlayerChips />}
                    summaryFor="players"
                    dock={
                        canReact && room.presence !== null && me ? (
                            <SessionReactions
                                key={snapshot.room.id}
                                presence={room.presence}
                                selfId={me.presenceId}
                                online={room.online}
                                originFor={avatarOrigin}
                                labelFor={(senderId) =>
                                    players.find(
                                        (player) =>
                                            player.presenceId === senderId,
                                    )?.name ?? null
                                }
                                variant="inline"
                                compact={isMobile}
                                shortcuts={!isTyping}
                                emojiData={snapshot.emojiData}
                                toolbarProps={{ className: reactionBarClass }}
                            />
                        ) : undefined
                    }
                />
            </SessionShell>
        </RoomProvider>
    );
}
