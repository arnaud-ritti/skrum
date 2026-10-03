import {
    createContext,
    useContext,
    type Dispatch,
    type ReactNode,
} from 'react';
import type { GameEvent } from '@/hooks/use-game-channel';
import type { BoardAction } from '@/lib/retro/board-reducer';
import type { PresenceMember, Snapshot } from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';

export type BoardContextValue = {
    board: Snapshot;
    dispatch: Dispatch<BoardAction>;
    apply: (action: BoardAction) => void;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    hasActiveCard: (cardId: string) => boolean;
    refetch: () => Promise<void>;
    invalidateSurvey: (surveyId: string) => void;
    sessionExpired: boolean;
    online: PresenceMember[];
    presence: WhisperChannel | null;
    isEditable: boolean;
    unreadCardIds: Set<string>;
    markCommentsRead: (cardId: string) => void;
    subscribeGameEvents: (listener: (event: GameEvent) => void) => () => void;
    /** Called on each nudge of the facilitator in the ROTI phase. */
    subscribeRotiNudges: (listener: () => void) => () => void;
    /** Called with how many write on an anonymous retro. */
    subscribeWritingCount: (listener: (count: number) => void) => () => void;
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

/** For components shared with game rooms, which have no board. */
export function useOptionalBoard(): BoardContextValue | null {
    return useContext(BoardContext);
}
