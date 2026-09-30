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

export type GameLeaderboardPeriod = '30d' | 'all';

export type TeamGameLeaderboardRow = {
    userId: string;
    name: string;
    avatarUrl: string;
    points: number;
    wins: number;
    roundsPlayed: number;
    streak: number;
};
