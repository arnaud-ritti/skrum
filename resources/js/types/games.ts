import type { GameKind, GameOption, GameRoomAccess } from '@/lib/games/types';

export type GameRoomSummary = {
    id: string;
    name: string | null;
    game: GameKind;
    gameLabel: string;
    access: GameRoomAccess;
    playersCount: number;
    roundsCount: number;
    updatedAt: string | null;
};

export type { GameOption };
