import type { Dispatch } from 'react';
import { useRetroBoard } from '@/hooks/use-retro-board';
import { useTrans } from '@/hooks/use-trans';
import type { BoardAction } from '@/lib/retro/board-reducer';
import type { Snapshot } from '@/lib/retro/types';
import { BoardEnded } from './board-ended';
import { BoardHeader } from './board-header';
import { ConnectionBanner } from './connection-banner';
import { RetroColumn } from './retro-column';

export type BoardContextValue = {
    board: Snapshot;
    dispatch: Dispatch<BoardAction>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    refetch: () => Promise<void>;
};

export function Board({ snapshot }: { snapshot: Snapshot }) {
    const { t } = useTrans();
    const { board, dispatch, run, refetch, status, online, reconnecting } =
        useRetroBoard(snapshot);

    if (status !== 'active') {
        return <BoardEnded reason={status} teamUrl={board.links.team} />;
    }

    const ctx: BoardContextValue = { board, dispatch, run, refetch };

    return (
        <div className="flex min-h-dvh flex-col">
            <BoardHeader board={board} online={online} />
            <ConnectionBanner reconnecting={reconnecting} />
            <main className="flex flex-1 items-start gap-4 overflow-x-auto p-4">
                {board.columns.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        {t('No columns yet.')}
                    </p>
                )}
                {board.columns.map((column) => (
                    <RetroColumn key={column.id} column={column} ctx={ctx} />
                ))}
            </main>
        </div>
    );
}
