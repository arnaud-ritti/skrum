import { GameBoard } from './game-board';
import { useRoom } from './room-context';
import { RoomSidebar } from './room-sidebar';
import { RoundEndCard } from './round-end-card';

export function GamePanel() {
    const { snapshot, lastEnded } = useRoom();
    const { round } = snapshot;

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:flex-row">
            <main className="flex min-w-0 flex-1 flex-col items-center gap-4">
                {round ? <GameBoard round={round} /> : <RoundEndCard />}
            </main>
            <aside className="w-full shrink-0 lg:w-64">
                <RoomSidebar
                    highlightPlayerId={
                        round ? null : (lastEnded?.winnerPlayerId ?? null)
                    }
                />
            </aside>
        </div>
    );
}
