import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useBoard } from './board-context';
import { BoardCursors } from './board-cursors';
import { IcebreakerGame } from './icebreaker-game';

/** The board area during the Icebreaker phase: the game instead of columns. */
export function IcebreakerStage({ hideMyCursor }: { hideMyCursor: boolean }) {
    const { board } = useBoard();
    const [element, setElement] = useState<HTMLElement | null>(null);

    if (board.icebreaker === null) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <Spinner />
            </div>
        );
    }

    return (
        <div ref={setElement} className="relative flex flex-1 flex-col">
            <IcebreakerGame
                key={board.icebreaker.room.id}
                snapshot={board.icebreaker}
            />
            <BoardCursors container={element} hidden={hideMyCursor} />
        </div>
    );
}
