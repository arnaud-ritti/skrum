import { MessagesSquare, Shapes, Trophy, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { SessionPresence } from '@/components/session/session-presence';
import { SessionReactions } from '@/components/session/session-reactions';
import { SessionShell } from '@/components/session/session-shell';
import { avatarOrigin } from '@/components/session/use-flying-reactions';
import { useGameRoom } from '@/hooks/use-game-room';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type { GameSnapshot } from '@/lib/games/types';
import { realtimeState } from '@/lib/realtime/realtime-state';
import {
    GameLayout,
    useHasRightColumn,
    type GameLayoutPanel,
    type GameLayoutProps,
} from './game-layout';
import { GamePicker } from './game-picker';
import { GameStage } from './game-stage';
import { PlayerChips } from './player-chips';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomFull } from './room-full';
import { RoomGone } from './room-gone';
import { RoomActions, RoomTimer, RoomTitle } from './room-header';
import { hasPlayersOnLeft, RoomPlayersSide, RoomSidebar } from './room-sidebar';

export type GameRoomProps = {
    snapshot: GameSnapshot;
    /** Places left for later features; nothing fills them today. */
    settingsCard?: ReactNode;
    turnOrder?: ReactNode;
    roundInfo?: ReactNode;
    gifCaption?: ReactNode;
    gifPodium?: ReactNode;
};

const reactionBarClass =
    'rounded-full border border-border bg-popover shadow-raised';

export function GameRoom({
    snapshot: initial,
    settingsCard,
    turnOrder,
    roundInfo,
    gifCaption,
    gifPodium,
}: GameRoomProps) {
    const room = useGameRoom(initial, { subscribe: true });
    const isMobile = useIsMobile();
    const hasRightColumn = useHasRightColumn();
    const { t } = useTrans();

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

    const winnerPlayerId = round ? null : (lastEnded?.winnerPlayerId ?? null);
    const playersOnLeft = hasPlayersOnLeft(snapshot.room.game);
    const isDraw = snapshot.room.game === 'draw';
    /** "Your pick" heads the right column while the players pick their GIF. */
    const isPickingGif =
        hasRightColumn && round?.game === 'gif' && round.revealedAt === null;
    const choice: GameLayoutPanel | undefined = snapshot.room.isHost
        ? {
              id: 'choice',
              label: t('Choose a game'),
              icon: Shapes,
              content: (
                  <GamePicker
                      settings={playersOnLeft ? undefined : settingsCard}
                  />
              ),
          }
        : undefined;
    const side = (
        <RoomSidebar
            highlightPlayerId={winnerPlayerId}
            turnOrder={turnOrder}
            gifPodium={gifPodium}
            gifCaption={gifCaption}
        />
    );
    /**
     * Each game follows its own mockup: players on the left for Draw & Guess
     * and Sprint in one GIF. The guesses of a drawing have their column only
     * during a round; under it they stand on the stage.
     */
    const panels: Pick<GameLayoutProps, 'left' | 'right' | 'chooser'> =
        playersOnLeft
            ? {
                  left: {
                      id: 'players',
                      label: isDraw ? t('Players') : t('Participants'),
                      icon: Users,
                      content: (
                          <RoomPlayersSide
                              highlightPlayerId={winnerPlayerId}
                              turnOrder={turnOrder}
                              settings={settingsCard}
                          />
                      ),
                  },
                  right: isDraw
                      ? hasRightColumn && round?.game === 'draw'
                          ? {
                                id: 'guesses',
                                label: t('Guesses'),
                                icon: MessagesSquare,
                                content: side,
                            }
                          : undefined
                      : {
                            id: 'scores',
                            label: isPickingGif ? t('Your pick') : t('Scores'),
                            icon: Trophy,
                            content: side,
                        },
                  chooser: choice,
              }
            : {
                  left: choice,
                  right: {
                      id: 'players',
                      label: t('Players and scores'),
                      icon: Users,
                      content: side,
                  },
              };

    const canReact =
        snapshot.room.reactionsEnabled &&
        room.presence !== null &&
        me !== undefined;

    return (
        <RoomProvider value={ctx}>
            <SessionShell
                kind="game"
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
                    variant={playersOnLeft ? 'players' : 'choice'}
                    {...panels}
                    stage={
                        <GameStage
                            roundInfo={roundInfo}
                            gifCaption={gifCaption}
                        />
                    }
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
