import {
    ListOrdered,
    MessagesSquare,
    Shapes,
    SlidersHorizontal,
    Trophy,
    Users,
} from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { decodedPuzzles } from '@/lib/games/decoded';
import type { GameRoundEnded, GameSnapshot } from '@/lib/games/types';
import { DecodedPuzzles } from './decoded-puzzles';
import {
    useHasLeftColumn,
    useHasRightColumn,
    useIsPhone,
    type GameLayoutPanel,
    type GameLayoutProps,
} from './game-layout';
import { GamePicker } from './game-picker';
import { GameSettingsCard } from './game-settings-card';
import { hasPlayersOnLeft, RoomPlayersSide, RoomSidebar } from './room-sidebar';
import { TurnOrder } from './turn-order';

type RoomPanelsOptions = {
    snapshot: GameSnapshot;
    lastEnded: GameRoundEnded | null;
    /**
     * In the icebreaker of a retro the players see the game cards beside the
     * stage, without choosing; on a narrower screen the sheet of the cards is
     * the facilitator's alone.
     */
    watchChoice?: boolean;
};

type RoomPanels = Required<Pick<GameLayoutProps, 'variant'>> &
    Pick<GameLayoutProps, 'left' | 'right' | 'chooser'>;

/**
 * The columns of a game, shared by a room and by the icebreaker stage of a
 * retro. Each game follows its own mockup: players on the left for Draw &
 * Guess and Sprint in one GIF. The guesses of a drawing have their column
 * only during a round; under it they stand on the stage.
 */
export function useRoomPanels({
    snapshot,
    lastEnded,
    watchChoice = false,
}: RoomPanelsOptions): RoomPanels {
    const { t } = useTrans();
    const hasLeftColumn = useHasLeftColumn();
    const hasRightColumn = useHasRightColumn();
    const isPhone = useIsPhone();
    const { room, round } = snapshot;
    const winnerPlayerId = round ? null : (lastEnded?.winnerPlayerId ?? null);
    const playersOnLeft = hasPlayersOnLeft(room.game);
    const isDraw = room.game === 'draw';
    const settingsCard = <GameSettingsCard />;
    const turnOrder = <TurnOrder />;
    const side = (
        <RoomSidebar highlightPlayerId={winnerPlayerId} turnOrder={turnOrder} />
    );
    const choice: GameLayoutPanel | undefined = room.isHost
        ? {
              id: 'choice',
              label: t('Choose a game'),
              icon: Shapes,
              content: (
                  <GamePicker
                      settings={playersOnLeft ? undefined : settingsCard}
                      inRetro={watchChoice}
                  />
              ),
          }
        : undefined;

    if (playersOnLeft) {
        const scores: GameLayoutPanel = {
            id: 'scores',
            label: t('Scores'),
            icon: Trophy,
            content: side,
        };
        const guesses: GameLayoutPanel | undefined =
            hasRightColumn && round?.game === 'draw'
                ? {
                      id: 'guesses',
                      label: t('Guesses'),
                      icon: MessagesSquare,
                      content: side,
                  }
                : undefined;

        return {
            variant: 'players',
            left: {
                id: 'players',
                label: room.game === 'gif' ? t('Participants') : t('Players'),
                icon: Users,
                content: (
                    <RoomPlayersSide
                        highlightPlayerId={winnerPlayerId}
                        turnOrder={turnOrder}
                        settings={settingsCard}
                    />
                ),
            },
            right: isDraw ? guesses : scores,
            chooser: choice,
        };
    }

    /**
     * Decoded's puzzles hold the left column, above the settings card, as in
     * its mockup, during a round and between two rounds of the game; the
     * host's game cards wait behind the chooser, and so do the read-only
     * cards of a retro's players. On a phone the round line of the stage
     * stands for them.
     */
    if (!isPhone && decodedPuzzles(snapshot.history, round, room) !== null) {
        const watchedCards: GameLayoutPanel | undefined =
            watchChoice && hasLeftColumn
                ? {
                      id: 'choice',
                      label: t('Games'),
                      icon: Shapes,
                      content: <GamePicker readOnly />,
                  }
                : undefined;

        return {
            variant: 'choice',
            left: {
                id: 'puzzles',
                label: t('Puzzles'),
                icon: ListOrdered,
                content: (
                    <>
                        <DecodedPuzzles />
                        <span className="flex-1" />
                        {settingsCard}
                    </>
                ),
            },
            right: {
                id: 'players',
                label: t('Players and scores'),
                icon: Users,
                content: side,
            },
            chooser: choice
                ? {
                      ...choice,
                      content: <GamePicker inRetro={watchChoice} />,
                  }
                : watchedCards,
        };
    }

    const watched: GameLayoutPanel | undefined =
        watchChoice && hasLeftColumn
            ? {
                  id: 'choice',
                  label: t('Games'),
                  icon: Shapes,
                  content: <GamePicker readOnly settings={settingsCard} />,
              }
            : undefined;
    /** A manager who is not the host sets the game without choosing it. */
    const managed: GameLayoutPanel | undefined =
        !room.isHost && room.canManage
            ? {
                  id: 'settings',
                  label: t('Game settings'),
                  icon: SlidersHorizontal,
                  content: settingsCard,
              }
            : undefined;

    return {
        variant: 'choice',
        left: choice ?? watched ?? managed,
        right: {
            id: 'players',
            label: t('Players and scores'),
            icon: Users,
            content: side,
        },
    };
}
