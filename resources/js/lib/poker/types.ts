export type PokerRevealReason = 'manual' | 'everyone_voted' | 'timer';

export type PokerResult = {
    average: number | null;
    distribution: { value: string; count: number }[];
    mode: string[];
    consensus: boolean;
    nearestCard: string | null;
};

export type PokerRoundVote = { playerId: string; value: string | null };

export type PokerRound = {
    id: string;
    number: number;
    anonymous: boolean;
    revealedAt: string | null;
    revealReason: PokerRevealReason | null;
    timerEndsAt: string | null;
    version: number;
    votesCount: number;
    votes: PokerRoundVote[];
    myVote: string | null;
    result: PokerResult | null;
};

export type PokerTask = {
    id: string;
    title: string;
    description: string | null;
    descriptionHtml: string;
    position: number;
    estimate: string | null;
    estimatedAt: string | null;
    roundsCount: number;
    external: null;
};

export type PokerPlayer = {
    id: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
    isSpectator: boolean;
};

export type PokerGame = {
    id: string;
    title: string;
    deck: string;
    deckLabel: string;
    cards: string[];
    isNumeric: boolean;
    facilitatorPlayerId: string | null;
    guestAccessEnabled: boolean;
    guestUrl: string | null;
    endedAt: string | null;
    currentTaskId: string | null;
    tasksCount: number;
    estimatedCount: number;
    totalPoints: number | null;
    hasVotes: boolean;
    autoReveal: boolean;
    anonymousVotes: boolean;
    cursorsEnabled: boolean;
    reactionsEnabled: boolean;
};

export type PokerMe = {
    playerId: string;
    userId: string | null;
    isGuest: boolean;
    isFacilitator: boolean;
    isSpectator: boolean;
    canVote: boolean;
    canEditTasks: boolean;
    canTakeControl: boolean;
    canDelete: boolean;
    transferCandidates: { userId: string; name: string }[];
};

export type PokerCurrent = { taskId: string; round: PokerRound };

export type PokerSnapshot = {
    game: PokerGame;
    me: PokerMe;
    players: PokerPlayer[];
    tasks: PokerTask[];
    current: PokerCurrent | null;
    links: { team: string | null };
    serverTime: string;
};

export type PokerVoteResponse = {
    roundId: string;
    myVote: string | null;
    votesCount: number;
    version: number;
    revealed: boolean;
};

export const SpecialCards: readonly string[] = ['?', '☕'];

export function isSpecialCard(card: string): boolean {
    return SpecialCards.includes(card);
}
