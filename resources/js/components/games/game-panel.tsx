import { RoundBoard, RoundStatus } from './game-stage';
import { PassRoundButton } from './pass-round-button';
import { useRoom } from './room-context';
import { hasPlayersOnLeft, RoomPlayersSide, RoomSidebar } from './room-sidebar';
import { RoundEndCard } from './round-end-card';

/**
 * The two columns of the icebreaker stage of a retro, which still stands on
 * its old frame: Task G6 moves it to GameLayout and deletes this file.
 */
export function GamePanel() {
    const { snapshot, lastEnded } = useRoom();
    const { round } = snapshot;
    const winnerPlayerId = round ? null : (lastEnded?.winnerPlayerId ?? null);

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:flex-row">
            <main className="flex min-w-0 flex-1 flex-col items-center gap-4">
                {round ? (
                    <div className="flex w-full flex-col items-center gap-4">
                        <RoundStatus round={round} />
                        <RoundBoard round={round} />
                        <div className="flex w-full max-w-5xl justify-end">
                            <PassRoundButton round={round} />
                        </div>
                    </div>
                ) : (
                    <RoundEndCard />
                )}
            </main>
            <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-64">
                {hasPlayersOnLeft(snapshot.room.game) && (
                    <RoomPlayersSide highlightPlayerId={winnerPlayerId} />
                )}
                <RoomSidebar highlightPlayerId={winnerPlayerId} />
            </aside>
        </div>
    );
}
