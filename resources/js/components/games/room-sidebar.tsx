import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind } from '@/lib/games/types';
import { useHasRightColumn } from './game-layout';
import { GifPodium } from './gif-podium';
import { GifSteps, useGifStep } from './gif-steps';
import { GifVoteBudget } from './gif-vote-budget';
import { GifYourPick } from './gif-your-pick';
import { GuessChat } from './guess-chat';
import { HangmanFeed } from './hangman-feed';
import { useRoom } from './room-context';
import { RoomPlayers } from './room-players';

/** Draw & Guess and Sprint in one GIF put their players on the left, as their mockups do. */
export function hasPlayersOnLeft(game: GameKind): boolean {
    return game === 'draw' || game === 'gif';
}

export type RoomPlayersSideProps = {
    /** The winner of the round that just ended. */
    highlightPlayerId: string | null;
    /** Place left under the players for the drawing order (GM-2). */
    turnOrder?: ReactNode;
    /** Place left at the foot of the column for the settings card of the game (GM-1). */
    settings?: ReactNode;
};

/** The left column of Draw & Guess and Sprint in one GIF: who plays, then what the game adds. */
export function RoomPlayersSide({
    highlightPlayerId,
    turnOrder,
    settings,
}: RoomPlayersSideProps) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const gifStep = useGifStep();
    const isGif = snapshot.room.game === 'gif';
    const { round } = snapshot;

    return (
        <>
            {round?.game === 'gif' && (
                <GifVoteBudget round={round} className="border-b pb-5" />
            )}
            <RoomPlayers
                title={isGif ? t('Participants') : t('Players')}
                points={!isGif}
                highlightPlayerId={highlightPlayerId}
            />
            {!isGif && turnOrder}
            {gifStep !== null && (
                <div className="border-t pt-5">
                    <GifSteps step={gifStep} />
                </div>
            )}
            {settings !== undefined && (
                <>
                    <span className="flex-1" />
                    {settings}
                </>
            )}
        </>
    );
}

export type RoomSidebarProps = {
    /** The winner of the round that just ended. */
    highlightPlayerId: string | null;
    /** Place left under the scores for the turn order of a game (GM-2). */
    turnOrder?: ReactNode;
};

/**
 * The right column of a game: one "Scores" list, then what the game in play
 * adds. Draw & Guess has its players on the left, and only the guesses of the
 * round in play here. While the players of Sprint in one GIF pick, "Your pick"
 * stands above the scores, and after the close "This sprint's GIF"; where the
 * column is a sheet, the stage holds "Your pick".
 */
export function RoomSidebar({
    highlightPlayerId,
    turnOrder,
}: RoomSidebarProps) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const { round, room } = snapshot;
    const hasRightColumn = useHasRightColumn();

    if (room.game === 'draw') {
        if (!hasRightColumn || round?.game !== 'draw') {
            return null;
        }

        return (
            <GuessChat
                round={round}
                isLeader={round.leaderPlayerId === snapshot.me.playerId}
                className="min-h-64 flex-1"
            />
        );
    }

    const isGif = room.game === 'gif';
    const isPickingGif =
        hasRightColumn && round?.game === 'gif' && round.revealedAt === null;

    return (
        <>
            {isPickingGif && (
                <GifYourPick round={round} className="border-b pb-5" />
            )}
            {isGif && <GifPodium className="border-b pb-5" />}
            <RoomPlayers
                title={t('Scores')}
                headingId={isGif ? 'game-scores' : 'game-players'}
                status={!isGif}
                highlightPlayerId={isGif ? null : highlightPlayerId}
            />
            {!isGif && turnOrder}
            {round?.game === 'hangman' && hasRightColumn && (
                <HangmanFeed round={round} className="border-t pt-5" />
            )}
            {round?.game === 'decoded' && hasRightColumn && (
                <GuessChat
                    round={round}
                    isLeader={round.leaderPlayerId === snapshot.me.playerId}
                    className="min-h-64 flex-1 border-t pt-5"
                />
            )}
        </>
    );
}
