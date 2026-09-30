import {
    createContext,
    useContext,
    type Dispatch,
    type ReactNode,
} from 'react';
import type { GameAction } from '@/lib/poker/game-reducer';
import type { PokerSnapshot } from '@/lib/poker/types';
import type { PresenceMember } from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PokerDeckOption } from '@/types';

export type GameContextValue = {
    snapshot: PokerSnapshot;
    dispatch: Dispatch<GameAction>;
    apply: (action: GameAction) => void;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    refetch: () => Promise<void>;
    sessionExpired: boolean;
    online: PresenceMember[];
    presence: WhisperChannel | null;
    serverOffset: number;
    deckOptions: PokerDeckOption[];
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
    value,
    children,
}: {
    value: GameContextValue;
    children: ReactNode;
}) {
    return <GameContext value={value}>{children}</GameContext>;
}

export function useGame(): GameContextValue {
    const value = useContext(GameContext);

    if (!value) {
        throw new Error('useGame() must be used inside <GameProvider>.');
    }

    return value;
}
