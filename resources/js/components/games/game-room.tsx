import { RotateCw } from 'lucide-react';
import { SessionPresence } from '@/components/session/session-presence';
import { RoomGone } from '@/components/session/room-gone';
import { SessionReactions } from '@/components/session/session-reactions';
import { SessionShell } from '@/components/session/session-shell';
import { EmptyState } from '@/components/skrum/empty-state';
import { avatarOrigin } from '@/components/session/use-flying-reactions';
import { useGameRoom } from '@/hooks/use-game-room';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type { GameSnapshot } from '@/lib/games/types';
import { realtimeState } from '@/lib/realtime/realtime-state';
import { GameLayout } from './game-layout';
import { GameStage } from './game-stage';
import { PlayerChips } from './player-chips';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomActions, RoomGame, RoomTimer, RoomTitle } from './room-header';
import { useRoomPanels } from './room-panels';

type GameRoomProps = {
    snapshot: GameSnapshot;
};

const reactionBarClass =
    'rounded-full border border-border bg-popover shadow-raised';

export function RoomFull({ maxPlayers }: { maxPlayers: number }) {
    const { t } = useTrans();

    return (
        <main
            data-slot="room-full"
            className="grid min-h-svh place-items-center bg-skrum-canvas p-6"
        >
            <EmptyState
                module="icebreaker"
                headingLevel="h2"
                title={t('This room is full.')}
                description={t('Up to :count players can be online at once.', {
                    count: maxPlayers,
                })}
                action={{
                    label: t('Try again'),
                    icon: RotateCw,
                    variant: 'outline',
                    onClick: () => window.location.reload(),
                }}
            />
        </main>
    );
}

export function GameRoom({ snapshot: initial }: GameRoomProps) {
    const room = useGameRoom(initial, { subscribe: true });
    const isMobile = useIsMobile();
    const { t } = useTrans();
    const panels = useRoomPanels({
        snapshot: room.state.snapshot,
        lastEnded: room.state.lastEnded,
    });

    if (room.full) {
        return (
            <RoomFull maxPlayers={room.state.snapshot.room.maxOnlinePlayers} />
        );
    }

    if (room.status !== 'active') {
        const isDeleted = room.status === 'deleted';

        return (
            <RoomGone
                module="icebreaker"
                title={
                    isDeleted
                        ? t('This room was deleted.')
                        : t('Your access to this room has ended.')
                }
                description={
                    isDeleted
                        ? t('Its rounds and scores are deleted for everyone.')
                        : t('Ask the host for a way back in.')
                }
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
                observing={snapshot.viewerIsObserver && !snapshot.room.isHost}
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
                phases={<RoomGame />}
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
                    stage={<GameStage />}
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
