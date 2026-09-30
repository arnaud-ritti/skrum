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

export type DrawingColor =
    | 'black'
    | 'red'
    | 'orange'
    | 'green'
    | 'blue'
    | 'purple'
    | 'white';

export type DrawingSize = 4 | 10 | 24;

/** Integer coordinates on the logical 1000 × 750 canvas. */
export type DrawingPoint = [number, number];

export type DrawingOp =
    | {
          type: 'stroke';
          color: DrawingColor;
          size: DrawingSize;
          points: DrawingPoint[];
      }
    | { type: 'fill'; color: DrawingColor; x: number; y: number };

export type GameGuessEntry = {
    id: string;
    playerId: string;
    text: string;
    /** Only on the viewer's own near misses. */
    veryClose?: boolean;
};

/** Proxied through skrum: never a provider URL. */
export type GameGif = { id: string; previewUrl: string; url: string };

/** Before the reveal: only who answered. */
export type GameGifPending = { playerId: string; answered: true };

/** After the reveal; playerId is null on anonymous retros, votes only once the round closed. */
export type GameGifRevealed = {
    id: string;
    gif: GameGif;
    playerId: string | null;
    votes?: number | null;
};

export type GameGifSlot = GameGifPending | GameGifRevealed;

export type GameMyGifAnswer = { id: string; gif: GameGif };

export type GameGifSearchResult = {
    id: string;
    previewUrl: string;
    width: number;
    height: number;
};

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
    /** The secret word: only ever present for the round's leader. */
    word?: string;
    maxHints?: number;
    guesses?: GameGuessEntry[];
    drawing?: DrawingOp[];
    clue?: string[];
    /** Client only: ids of the latest committed strokes, to drop their live previews. */
    committedOpIds?: string[];
    question?: string | null;
    gifProvider?: 'giphy' | 'tenor' | null;
    answers?: GameGifSlot[];
    myAnswer?: GameMyGifAnswer | null;
    voters?: string[];
    myVote?: string | null;
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
    drawing?: DrawingOp[];
    clue?: string[];
    answers?: GameGifRevealed[];
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
    question?: string | null;
    answers?: GameGifRevealed[];
};

export type GameRoundRevealed = {
    roundId: string;
    revealedAt: string;
    answers: GameGifRevealed[];
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

export type GameGuessMade = {
    roundId: string;
    guessId: string;
    playerId: string;
    text: string;
};

export type GameDrawingOpAdded = {
    roundId: string;
    op: DrawingOp;
    clientOpId: string;
    /** Operations in the drawing after this one was added. */
    count: number;
};

/** Undo and clear: the broadcast and the drawer's response. */
export type GameDrawingCount = { roundId: string; count: number };

export type GameGuessResponse = {
    result: 'wrong' | 'near' | 'correct';
    guessId: string;
    ended: GameRoundEnded | null;
};

export type GameHintResponse = { roundId: string; mask: GameMask };

export type GameDrawingOpResponse = GameDrawingOpAdded;

export type GameClueResponse = { roundId: string; clue: string[] };

export type GameSecretResponse = { word: string };

export type EmojiDataLocation = { baseUrl: string; locale: string };

export type GameSnapshot = {
    room: GameRoomInfo;
    me: { playerId: string; userId: string | null; isGuest: boolean };
    players: GamePlayer[];
    games: GameOption[];
    round: GameRound | null;
    history: GameHistoryRound[];
    links: { team: string | null; retro: string | null };
    emojiData: EmojiDataLocation;
    serverTime: string;
};

export type GameRoomState = {
    snapshot: GameSnapshot;
    /** The last round seen ending, kept for the end card until the next round starts. */
    lastEnded: GameRoundEnded | null;
    /** Bumped when an event does not fit the local state; the room refetches. */
    resyncRequests: number;
};
