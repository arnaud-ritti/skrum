import type { GameKind, GameOption, GameRoomAccess } from '@/lib/games/types';

type GameRoomSummaryPlayer = {
    id: string;
    name: string;
    avatarUrl: string;
};

export type GameRoomSummary = {
    id: string;
    name: string | null;
    game: GameKind;
    gameLabel: string;
    access: GameRoomAccess;
    status: 'playing' | 'waiting';
    players: GameRoomSummaryPlayer[];
    playersCount: number;
    roundsCount: number;
    roundStartedAt: string | null;
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
    gamesPlayed: number;
    streak: number;
};

export type TeamGameRoomChangedPayload = {
    room: GameRoomSummary;
};

export type TeamGameRoomDeletedPayload = {
    roomId: string;
};
