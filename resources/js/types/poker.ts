import type { PokerRound } from '@/lib/poker/types';

export type PokerDeckOption = { value: string; label: string; cards: string[] };

export type PokerGameSummary = {
    id: string;
    title: string;
    deckLabel: string;
    tasksCount: number;
    estimatedCount: number;
    totalPoints: number | null;
    endedAt: string | null;
    lastActivityAt: string;
};

export type EstimatedTaskRow = {
    id: string;
    title: string;
    gameId: string;
    gameTitle: string;
    estimate: string;
    roundsCount: number;
    estimatedAt: string;
    rounds: PokerRound[];
    players: { id: string; name: string }[];
};

export type SavedPokerDeck = {
    id: string;
    name: string;
    cards: string[];
    canManage?: boolean;
};
