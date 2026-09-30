import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useBoard } from './board-context';
import { IcebreakerGame } from './icebreaker-game';
import { LiveCursorLayer } from './live-cursor-layer';

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
        <main ref={setElement} className="relative flex flex-1 flex-col">
            <IcebreakerGame
                key={board.icebreaker.room.id}
                snapshot={board.icebreaker}
            />
            <LiveCursorLayer container={element} hidden={hideMyCursor} />
        </main>
    );
}
