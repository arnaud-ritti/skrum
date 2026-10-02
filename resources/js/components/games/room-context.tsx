import {
    createContext,
    useContext,
    type Dispatch,
    type ReactNode,
} from 'react';
import type { RoomAction } from '@/lib/games/room-reducer';
import type { GameRoundEnded, GameSnapshot } from '@/lib/games/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';
import { GifDraftProvider } from './gif-draft';

export type RoomContextValue = {
    snapshot: GameSnapshot;
    lastEnded: GameRoundEnded | null;
    dispatch: Dispatch<RoomAction>;
    apply: (action: RoomAction) => void;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    refetch: () => Promise<void>;
    /** Presence members: `id` is a player's presenceId. */
    online: PresenceMember[];
    presence: WhisperChannel | null;
    serverOffset: number;
    sessionExpired: boolean;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
    value,
    children,
}: {
    value: RoomContextValue;
    children: ReactNode;
}) {
    return (
        <RoomContext value={value}>
            <GifDraftProvider>{children}</GifDraftProvider>
        </RoomContext>
    );
}

export function useRoom(): RoomContextValue {
    const value = useContext(RoomContext);

    if (!value) {
        throw new Error('useRoom() must be used inside <RoomProvider>.');
    }

    return value;
}
