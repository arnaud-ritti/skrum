export type GameKind = 'draw' | 'gif' | 'hangman' | 'decoded';

export type GameRoundOutcome =
    | 'guessed'
    | 'solved'
    | 'lost'
    | 'timed_out'
    | 'passed'
    | 'revealed'
    | 'abandoned';

export type GameRoomAccess = 'team' | 'link';

export type GamePlayer = {
    id: string;
    presenceId: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
};

export type GameOption = { value: GameKind; label: string; available: boolean };

export type GameRoomInfo = {
    id: string;
    name: string | null;
    game: GameKind;
    locale: string;
    access: GameRoomAccess;
    timerEndsAt: string | null;
    isHost: boolean;
    canManage: boolean;
    canDelete: boolean;
    canBecomeHost: boolean;
    hostPlayerId: string | null;
    guestUrl: string | null;
    isIcebreaker: boolean;
    currentRoundId: string | null;
};

/** One entry per character: separators and revealed letters, null for hidden letters. */
export type GameMask = (string | null)[];

export type GameLetterPick = { playerId: string; letter: string; hit: boolean };

export type GameRound = {
    id: string;
    game: GameKind;
    leaderPlayerId: string | null;
    startedAt: string;
    revealedAt: string | null;
    mask?: GameMask;
    misses?: number;
    maxMisses?: number;
    pickedLetters?: string[];
    /** Client only: the latest picks seen live, oldest first. */
    recentPicks?: GameLetterPick[];
};

export type GameHistoryRound = {
    id: string;
    game: GameKind;
    outcome: GameRoundOutcome;
    word: string | null;
    question: string | null;
    leaderPlayerId: string | null;
    leaderName: string | null;
    winnerPlayerId: string | null;
    winnerName: string | null;
    endedAt: string;
};

export type GameRoundDetail = GameHistoryRound & {
    mask?: GameMask;
    misses?: number;
    maxMisses?: number;
    pickedLetters?: string[];
};

export type GamePointsAward = {
    playerId: string;
    points: number;
    isWin: boolean;
};

export type GameRoundEnded = {
    roundId: string;
    outcome: GameRoundOutcome;
    word: string | null;
    winnerPlayerId: string | null;
    leaderPlayerId: string | null;
    points: GamePointsAward[];
};

export type GameLetterPicked = {
    roundId: string;
    playerId: string;
    letter: string;
    hit: boolean;
    mask: GameMask;
    misses: number;
};

export type GameStartResponse = {
    round: GameRound;
    ended: GameRoundEnded | null;
};

export type GameLetterResponse = GameLetterPicked & {
    ended: GameRoundEnded | null;
};

export type GameSnapshot = {
    room: GameRoomInfo;
    me: { playerId: string; userId: string | null; isGuest: boolean };
    players: GamePlayer[];
    games: GameOption[];
    round: GameRound | null;
    history: GameHistoryRound[];
    links: { team: string | null; retro: string | null };
    serverTime: string;
};

export type GameRoomState = {
    snapshot: GameSnapshot;
    /** The last round seen ending, kept for the end card until the next round starts. */
    lastEnded: GameRoundEnded | null;
};
