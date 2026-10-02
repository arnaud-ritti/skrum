import { GameBoard } from './game-board';
import { useRoom } from './room-context';
import { RoomSidebar } from './room-sidebar';
import { RoundEndCard } from './round-end-card';

type Props = {
    /**
     * False where the page already has its `main`: the icebreaker stage of a
     * retro board sits inside the main of the session shell.
     */
    landmark?: boolean;
};

export function GamePanel({ landmark = true }: Props) {
    const { snapshot, lastEnded } = useRoom();
    const { round } = snapshot;
    const Stage = landmark ? 'main' : 'div';

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:flex-row">
            <Stage
                data-slot="game-stage"
                className="flex min-w-0 flex-1 flex-col items-center gap-4"
            >
                {round ? <GameBoard round={round} /> : <RoundEndCard />}
            </Stage>
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
