import { useRetroBoard } from '@/hooks/use-retro-board';
import type { Snapshot } from '@/lib/retro/types';
import { BoardEnded } from './board-ended';
import { BoardHeader } from './board-header';
import { ConnectionBanner } from './connection-banner';

export function Board({ snapshot }: { snapshot: Snapshot }) {
    const { board, status, online, connected } = useRetroBoard(snapshot);

    if (status !== 'active') {
        return <BoardEnded reason={status} teamUrl={board.links.team} />;
    }

    return (
        <div className="flex min-h-dvh flex-col">
            <BoardHeader board={board} online={online} />
            <ConnectionBanner connected={connected} />
            <main className="flex flex-1 items-start gap-4 overflow-x-auto p-4">
                {board.columns.map((column) => (
                    <section
                        key={column.id}
                        className="w-72 shrink-0 rounded-lg border p-3"
                    >
                        {column.title}
                    </section>
                ))}
            </main>
        </div>
    );
}
