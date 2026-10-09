import type { IntegrationDelivery, ShareAvailability } from '@/types';

export type GameKind =
    | 'draw'
    | 'gif'
    | 'hangman'
    | 'decoded'
    | 'two_truths'
    | 'mood'
    | 'guess_who'
    | 'quick_question'
    | 'undercover';

export type GameRoundOutcome =
    | 'guessed'
    | 'solved'
    | 'lost'
    | 'timed_out'
    | 'passed'
    | 'revealed'
    | 'abandoned'
    | 'finished';

export type WordTheme = 'work' | 'objects' | 'food' | 'nature';

export type GameWeather =
    | 'sunny'
    | 'partly_cloudy'
    | 'cloudy'
    | 'rainy'
    | 'stormy';

export type GameRoomSettingsInfo = {
    wordThemes: WordTheme[];
    turnSeconds: number | null;
    autoHints: boolean;
    takesTurns: boolean;
    roundsPerGame: number | null;
    gifVotes: number;
    gifAuthorsHidden: boolean;
};

/** Guess who?: the drawn answer, without author until the close. */
export type GameTextRevealed = { id: string; text: string };

/** Guess who? once closed: the drawn answer and its author. */
export type GameDrawnAnswer = GameTextRevealed & { playerId: string };

/** Guess who? once closed: who named each candidate. */
export type GameNomination = { playerId: string; voterIds: string[] };

export type GameTurnChanged = {
    roundId: string;
    turnPlayerId: string | null;
    turnEndsAt: string | null;
};

/** Two truths: a prepared set became ready or stopped being ready (room-level, no round). */
export type GameStatementsChanged = { playerId: string; ready: boolean };

/** Guess who?: how many have voted, never who. */
export type GameVotesCounted = { roundId: string; voted: number };

export type GameTruthSet = {
    statements: string[];
    lieIndex: number;
    played: boolean;
};

/** The snapshot's `truthSets`: who has a ready set, and the viewer's own set. */
export type GameTruthSets = {
    ready: string[];
    mine: GameTruthSet | null;
};

export type GameWeatherCount = { weather: GameWeather; count: number };

export type GameStatementVotes = { index: number; playerIds: string[] };

export type GameWordGuess = {
    id: string;
    playerId: string;
    text: string;
    /** Client only: the arrival of a word seen live; none for those of the snapshot. */
    seq?: number;
};

/** Draw & Guess (spec §6.15): who found the word, when and for how many points. */
export type GameFinder = {
    playerId: string;
    seconds: number;
    points: number;
    /** Client only: the last guess seen when the finder arrived live; null before any guess. */
    afterGuessId?: string | null;
};

export type GameWordFound = { roundId: string } & GameFinder;

export type GameWordChanged = {
    roundId: string;
    mask: GameMask;
    maxHints: number;
};

export type GameRoomAccess = 'team' | 'link';

export type GamePlayer = {
    id: string;
    presenceId: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
    presence: number;
};

export type GameOption = { value: GameKind; label: string; available: boolean };

type GameRoomInfo = {
    id: string;
    name: string | null;
    game: GameKind;
    locale: string;
    access: GameRoomAccess;
    reactionsEnabled: boolean;
    timerEndsAt: string | null;
    isHost: boolean;
    canManage: boolean;
    canDelete: boolean;
    canBecomeHost: boolean;
    hostPlayerId: string | null;
    /** Above it, the presence channel refuses one more player. */
    maxOnlinePlayers: number;
    guestUrl: string | null;
    joinCode: string | null;
    isIcebreaker: boolean;
    currentRoundId: string | null;
    teamName: string | null;
    settings: GameRoomSettingsInfo;
};

/** One entry per character: separators and revealed letters, null for hidden letters. */
export type GameMask = (string | null)[];

type GameLetterPick = {
    playerId: string;
    letter: string;
    hit: boolean;
    /** Client only: the arrival of the move among the round's letters and words. */
    seq?: number;
};

export type DrawingColor =
    | 'black'
    | 'red'
    | 'orange'
    | 'green'
    | 'blue'
    | 'purple'
    | 'sun'
    | 'apricot'
    | 'coral'
    | 'plum'
    | 'iris'
    | 'sky'
    | 'lagoon'
    | 'moss'
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
    caption?: string | null;
    rank?: number | null;
};

export type GameGifSlot = GameGifPending | GameGifRevealed;

export type GameMyGifAnswer = {
    id: string;
    gif: GameGif;
    caption: string | null;
};

export type GameGifSearchResult = {
    id: string;
    previewUrl: string;
    width: number;
    height: number;
};

export type UndercoverState = {
    stage: 'clues' | 'discussion' | 'voting';
    cycle: number;
    version: number;
    playerIds: string[];
    eliminated: { playerId: string; role: 'civilian' | 'undercover' }[];
    candidates: string[];
    myWord: string | null;
    myVote: string | null;
    votedCount: number;
};

export type UndercoverResultInfo = {
    words: { civilian: string; undercover: string };
    winner: 'civilian' | 'undercover' | null;
    players: {
        playerId: string;
        role: 'civilian' | 'undercover';
        eliminated: boolean;
    }[];
};

export type GameRound = {
    undercover?: UndercoverState;
    id: string;
    game: GameKind;
    leaderPlayerId: string | null;
    startedAt: string;
    revealedAt: string | null;
    number: number | null;
    roundsTotal: number | null;
    turnOrder: string[];
    turnPlayerId: string | null;
    turnEndsAt: string | null;
    turnSeconds: number | null;
    hintSeconds: number | null;
    mask?: GameMask;
    misses?: number;
    maxMisses?: number;
    pickedLetters?: string[];
    /** Client only: the latest picks seen live, oldest first. */
    recentPicks?: GameLetterPick[];
    /** The secret word: only ever present for the round's leader, and in Draw & Guess for who found it. */
    word?: string;
    maxHints?: number;
    /** Client only: the auto hints scheduled for the first word, kept after "New word". */
    hintSlots?: number;
    guesses?: GameGuessEntry[];
    /** Hangman: the latest wrong whole-word guesses, oldest first. */
    wordGuesses?: GameWordGuess[];
    drawing?: DrawingOp[];
    clue?: string[];
    /** Client only: ids of the latest committed strokes, to drop their live previews. */
    committedOpIds?: string[];
    question?: string | null;
    gifProvider?: 'giphy' | 'tenor' | null;
    answers?: GameGifSlot[];
    myAnswer?: GameMyGifAnswer | GameTextRevealed | null;
    voters?: string[];
    myVote?: string | null;
    statements?: string[];
    /** Two truths: only for the teller while the round is in play. */
    lieIndex?: number;
    myChoice?: number | string | null;
    threshold?: number;
    myVotes?: string[];
    votesAllowed?: number;
    /** Sprint in one GIF: the authors of the revealed GIFs come at the close. */
    authorsHidden?: boolean;
    drawn?: GameTextRevealed | null;
    candidates?: string[];
    votedCount?: number;
    /** Draw & Guess: who found the word, in the order they found it. */
    finders?: GameFinder[];
    /** Draw & Guess: null when the round was started without its guessers (the first find ends it). */
    guessersTotal?: number | null;
    pointsPerFinder?: number;
    /** Draw & Guess: only for the drawer. */
    wordChangesLeft?: number;
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
    number?: number | null;
    roundsTotal?: number | null;
    /** Decoded only: the clue, public once the round ended. */
    clue?: string[] | null;
};

export type GameRoundDetail = GameHistoryRound & {
    undercoverResult?: UndercoverResultInfo;
    mask?: GameMask;
    misses?: number;
    maxMisses?: number;
    pickedLetters?: string[];
    drawing?: DrawingOp[];
    clue?: string[];
    answers?: GameGifRevealed[];
    number?: number | null;
    roundsTotal?: number | null;
    statements?: string[];
    lieIndex?: number;
    votes?: GameStatementVotes[];
    answered?: number;
    weather?: GameWeatherCount[] | null;
    threshold?: number;
    drawn?: GameDrawnAnswer | null;
    nominations?: GameNomination[];
    finders?: GameFinder[];
};

export type GamePointsAward = {
    playerId: string;
    points: number;
    isWin: boolean;
};

export type GameRoundEnded = {
    undercoverResult?: UndercoverResultInfo;
    roundId: string;
    outcome: GameRoundOutcome;
    word: string | null;
    winnerPlayerId: string | null;
    leaderPlayerId: string | null;
    points: GamePointsAward[];
    question?: string | null;
    answers?: GameGifRevealed[];
    number?: number | null;
    roundsTotal?: number | null;
    statements?: string[];
    lieIndex?: number;
    votes?: GameStatementVotes[];
    answered?: number;
    weather?: GameWeatherCount[] | null;
    threshold?: number;
    drawn?: GameDrawnAnswer | null;
    nominations?: GameNomination[];
    finders?: GameFinder[];
};

export type GameRoundRevealed = {
    roundId: string;
    revealedAt: string;
    answers: GameGifRevealed[] | GameTextRevealed[];
    candidates?: string[];
    authorsHidden?: boolean;
};

export type GameLetterPicked = {
    roundId: string;
    playerId: string;
    letter: string;
    hit: boolean;
    mask: GameMask;
    misses: number;
    turnPlayerId: string | null;
    turnEndsAt: string | null;
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
    /** Hangman's whole-word guess: the round's misses after it. */
    misses?: number;
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
    /** Draw & Guess with guessers: the viewer just found the word. */
    found?: GameFinder;
    word?: string;
};

/** POST word-changes: the drawer's new word. */
export type GameWordChangeResponse = GameWordChanged & {
    word: string;
    wordChangesLeft: number;
};

export type GameWordGuessResponse = {
    result: 'correct' | 'wrong';
    guessId: string;
    misses: number;
    turnPlayerId: string | null;
    turnEndsAt: string | null;
    ended: GameRoundEnded | null;
};

export type GameHintResponse = { roundId: string; mask: GameMask };

export type GameDrawingOpResponse = GameDrawingOpAdded;

export type GameClueResponse = { roundId: string; clue: string[] };

export type GameSecretResponse = { word: string };

export type EmojiDataLocation = { baseUrl: string; locale: string };

export type GameLeaderboardRow = {
    playerId: string;
    points: number;
    wins: number;
    roundsPlayed: number;
};

export type GameSnapshot = {
    room: GameRoomInfo;
    me: { playerId: string; userId: string | null; isGuest: boolean };
    players: GamePlayer[];
    games: GameOption[];
    round: GameRound | null;
    truthSets: GameTruthSets | null;
    history: GameHistoryRound[];
    links: { team: string | null; retro: string | null };
    emojiData: EmojiDataLocation;
    /** The viewer is an observer of the team: they follow the room, unless they host it. */
    viewerIsObserver: boolean;
    serverTime: string;
    leaderboard: GameLeaderboardRow[];
    scoresResetAt: string | null;
    share: ShareAvailability;
    deliveries: IntegrationDelivery[];
};

export type GameRoomState = {
    snapshot: GameSnapshot;
    /** The last round seen ending, kept for the end card until the next round starts. */
    lastEnded: GameRoundEnded | null;
    /** Bumped when an event does not fit the local state; the room refetches. */
    resyncRequests: number;
};
