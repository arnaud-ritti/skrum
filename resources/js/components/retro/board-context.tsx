import {
    createContext,
    useContext,
    type Dispatch,
    type ReactNode,
} from 'react';
import type { BoardAction } from '@/lib/retro/board-reducer';
import type { Snapshot } from '@/lib/retro/types';

export type BoardContextValue = {
    board: Snapshot;
    dispatch: Dispatch<BoardAction>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    refetch: () => Promise<void>;
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
    value,
    children,
}: {
    value: BoardContextValue;
    children: ReactNode;
}) {
    return <BoardContext value={value}>{children}</BoardContext>;
}

export function useBoard(): BoardContextValue {
    const value = useContext(BoardContext);

    if (!value) {
        throw new Error('useBoard() must be used inside <BoardProvider>.');
    }

    return value;
}
