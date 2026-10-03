import type {
    GameGif,
    GameKind,
    GameOption,
    GameRoundOutcome,
    GameSnapshot,
} from '@/lib/games/types';
import type { IntegrationDelivery, ShareAvailability } from '@/types';
import type {
    ExportSource,
    ExternalLink,
    TrackerProviderKey,
} from '@/types/integrations';

export type RetroPhase =
    | 'icebreaker'
    | 'writing'
    | 'grouping'
    | 'voting'
    | 'discussing'
    | 'actions'
    | 'roti'
    | 'completed';
export type ColumnColor =
    | 'sun'
    | 'apricot'
    | 'coral'
    | 'plum'
    | 'iris'
    | 'sky'
    | 'lagoon'
    | 'moss';

export type CardSentiment = 'positive' | 'neutral' | 'negative';

type SummaryStatus = 'pending' | 'ready' | 'failed';

type ResultsSummary = {
    text: string | null;
    generatedAt: string | null;
    status: SummaryStatus | null;
    provider: string;
};

type RetroTheme = { id: string; name: string; cardIds: string[] };

type SuggestedActionStatus = 'pending' | 'promoted' | 'rejected';

export type SuggestedAction = {
    id: string;
    content: string;
    themeId: string | null;
    status: SuggestedActionStatus;
    actionItemId: string | null;
};

type Insights = {
    themes: RetroTheme[];
    suggestedActions: SuggestedAction[];
};

export type Person = { id: string; name: string };

export type CardGif = { id: string; previewUrl: string; url: string };

export type CardPayload = {
    id: string;
    columnId: string;
    parentCardId: string | null;
    position: number;
    isMine: boolean;
    hidden: boolean;
    content: string | null;
    gif: CardGif | null;
    author: Person | null;
    groupName: string | null;
};

export type ReactionSummary = {
    emoji: string;
    count: number;
    mine: boolean;
    names: string[];
};

export type CardComment = {
    id: string;
    cardId: string;
    parentCommentId: string | null;
    isMine: boolean;
    deleted: boolean;
    content: string | null;
    author: Person | null;
    createdAt: string;
};

export type CommentThread = CardComment & { replies: CardComment[] };

export type CommentNotificationPayload = {
    cardId?: string;
    surveyId?: string;
    commentId: string;
    threadId: string;
    excerpt: string;
    authorName?: string;
};

export type SurveyKind = 'single' | 'multiple' | 'text';

type SurveyOption = {
    id: string;
    label: string;
    position: number;
    count: number | null;
    voters: string[] | null;
};

type SurveyTextAnswer = {
    id: string;
    text: string;
    authorId: string | null;
    isMine: boolean;
};

export type SurveyComment = Omit<CardComment, 'cardId'> & { surveyId: string };

type SurveyCommentThread = SurveyComment & { replies: SurveyComment[] };

export type SurveyPayload = {
    id: string;
    kind: SurveyKind;
    question: string;
    description: string | null;
    position: number;
    isClosed: boolean;
    version: number;
    showVoters: boolean;
    responseCount: number;
    myOptionIds: string[];
    myText: string | null;
    resultsVisible: boolean;
    options: SurveyOption[];
    textAnswers: SurveyTextAnswer[] | null;
    reactions: ReactionSummary[];
    commentCount: number;
    comments: SurveyCommentThread[];
};

export type BoardCard = CardPayload & {
    votes: number | null;
    myVotes: number;
    reactions: ReactionSummary[];
    commentCount: number;
    comments: CommentThread[];
    sentiment: CardSentiment | null;
    category: string | null;
    /**
     * Client-only: the votes version `votes` was last set at. Totals are
     * ordered per card because the votes version is global to the retro.
     */
    totalVersion?: number;
};

export type BoardColumn = {
    id: string;
    title: string;
    description: string | null;
    color: ColumnColor;
    position: number;
};

export type BoardParticipant = {
    id: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
};

export type ActionItemPriority = 'high' | 'medium' | 'low';

export type ActionItemRecurrence = 'weekly' | 'every_two_weeks' | 'monthly';

type ActionItemSubtask = {
    id: string;
    content: string;
    isCompleted: boolean;
    position: number;
};

export type ActionItemStatus = 'open' | 'completed';

type ActionItemPerson = { name: string; avatarUrl: string };

export type ActionItemAssignee = ActionItemPerson & {
    kind: 'member' | 'guest';
    id: string;
    isTeamMember: boolean;
};

type ActionItemSource = {
    retroTitle: string;
    retroCreatedAt: string | null;
    retroUrl: string;
};

export type ActionItem = {
    id: string;
    retroId: string | null;
    teamId: string;
    content: string;
    priority: ActionItemPriority;
    dueOn: string | null;
    isOverdue: boolean;
    status: ActionItemStatus;
    completedAt: string | null;
    /** The tracker whose status sync completed the item. */
    completedVia: TrackerProviderKey | null;
    assignee: ActionItemAssignee | null;
    createdBy: ActionItemPerson | null;
    isMine: boolean;
    commentCount: number;
    source: ActionItemSource | null;
    themeId: string | null;
    themeName: string | null;
    recurrence: ActionItemRecurrence | null;
    previousOccurrenceId: string | null;
    subtasks: ActionItemSubtask[];
    createdAt: string | null;
    /** Members only; null in broadcasts, where clients keep what they know. */
    externalLinks: ExternalLink[] | null;
    /** Client-only: bumped by comment events so an open thread refetches. */
    commentsRevision?: number;
};

export type ActionItemComment = {
    id: string;
    actionItemId: string;
    content: string;
    author: ActionItemPerson | null;
    isMine: boolean;
    createdAt: string | null;
    updatedAt: string | null;
};

type TeamMember = {
    id: string;
    name: string;
    avatarUrl: string;
    participantId: string | null;
};

type TransferCandidate = { userId: string; name: string };

type HealthStatementPayload = {
    key: string;
    label: string;
    text: string;
    isBuiltin: boolean;
};

/** `health.answered`: how many have sent their answers, out of how many joined. */
export type HealthProgress = {
    respondents: number;
    participants: number;
};

export type HealthCheckStatement = HealthStatementPayload & {
    myScore: number | null;
};

/** The retro's health check, a team survey answered from the board. */
export type HealthCheckState = HealthProgress & {
    surveyId: string;
    isClosed: boolean;
    /** 5, or 10 for a health check imported open on the old scale. */
    scale: number;
    hasSubmitted: boolean;
    statements: HealthCheckStatement[];
    /** The summary on the health scale once the health check is closed. */
    results: HealthResults | null;
};

export type Snapshot = {
    retro: {
        id: string;
        teamId: string;
        /** Null for a guest, who is not told the team. */
        teamName: string | null;
        title: string;
        template: string;
        phase: RetroPhase;
        phases: RetroPhase[];
        /** How many statements the team asks, for the "Add survey" menu. */
        healthCheckStatements: number;
        icebreakerEnabled: boolean;
        icebreakerGame: GameKind;
        votesAuto: boolean;
        isAnonymous: boolean;
        reactionsEnabled: boolean;
        cursorsEnabled: boolean;
        gifsEnabled: boolean;
        gifProvider: 'giphy' | 'tenor' | null;
        hideVoteCounts: boolean;
        isLocked: boolean;
        presentationMode: boolean;
        votesPerParticipant: number;
        guestAccessEnabled: boolean;
        facilitatorParticipantId: string | null;
        timerEndsAt: string | null;
        highlightedCardId: string | null;
        completedAt: string | null;
        guestUrl: string | null;
        joinCode: string | null;
        aiSummaryEnabled: boolean;
    };
    viewer: {
        participantId: string;
        userId: string | null;
        canManageActionItems: boolean;
        isWorkspaceManager: boolean;
        isReviewFacilitator: boolean;
        facilitatedRetroIds: string[];
        isFacilitator: boolean;
        isGuest: boolean;
        remainingVotes: number;
        transferCandidates: TransferCandidate[];
        canHandleSuggestions: boolean;
    };
    columns: BoardColumn[];
    cards: BoardCard[];
    participants: BoardParticipant[];
    actionItems: ActionItem[];
    carriedActionItems: ActionItem[];
    carriedActionItemsHasMore: boolean;
    exportSources: ExportSource[];
    teamMembers: TeamMember[];
    surveys: SurveyPayload[];
    writersCount: number;
    roti: RotiState;
    results: Results | null;
    insights: Insights | null;
    features: { llm: boolean; llmProvider: string | null };
    healthCheck: HealthCheckState | null;
    icebreaker: GameSnapshot | null;
    icebreakerGames: GameOption[];
    integrations: ShareAvailability & { email: boolean };
    linkDeliveries: IntegrationDelivery[];
    votesCast: number | null;
    votesVersion: number;
    links: {
        team: string | null;
        actionItems: string | null;
        workspace: string | null;
    };
    emojiData: { baseUrl: string; locale: string };
    serverTime: string;
};

export type PresenceMember = {
    id: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
    /** The person's colour, 1 to 12, sent with the channel's member data. */
    presence?: number;
};

export type HealthStatementResult = {
    key: string;
    label: string;
    text: string;
    isBuiltin: boolean;
    average: number | null;
    count: number;
    previousAverage: number | null;
    /** Answers per score of the health scale, 1 to 5. */
    distribution: number[];
};

type HealthHighlight = { key: string; label: string; average: number };

export type HealthResults = {
    statements: HealthStatementResult[];
    score: number;
    participation: { respondents: number; participants: number };
    topStrength: HealthHighlight | null;
    growthArea: HealthHighlight | null;
    alignment: {
        value: number;
        level: 'high' | 'moderate' | 'divided';
        label: string;
    };
    assessment: {
        band: 'excellent' | 'good' | 'needs_attention' | 'critical';
        title: string;
        sentence: string;
    };
};

export type HealthTrendPoint = {
    /** Null for a health check run as a survey of its own. */
    retroId: string | null;
    surveyId: string;
    title: string;
    completedAt: string;
    score: number;
    url: string;
    delta: number | null;
    sameStatements: boolean;
};

export type RotiResults = {
    distribution: Array<{ score: number; count: number }>;
    average: number | null;
    respondents: number;
};

type RotiState = {
    myScore: number | null;
    respondents: number;
    voterIds: string[];
    /** True in the ROTI phase, and on a retro completed before that phase existed. */
    canVote: boolean;
};

/** What a vote or a retract answers. */
export type RotiVoteResponse = Omit<RotiState, 'canVote'>;

export type GamesPlayedPerson = {
    playerId: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
};

export type GamesPlayedRound = {
    id: string;
    game: GameKind;
    outcome: GameRoundOutcome;
    word: string | null;
    question: string | null;
    clue: string[] | null;
    leader: GamesPlayedPerson | null;
    winner: GamesPlayedPerson | null;
    answers:
        | { gif: GameGif; playerId: string | null; votes: number | null }[]
        | null;
    endedAt: string;
};

export type GamesPlayedLeaderRow = GamesPlayedPerson & {
    points: number;
    wins: number;
    roundsPlayed: number;
};

export type GamesPlayed = {
    roomId: string;
    rounds: GamesPlayedRound[];
    leaderboard: GamesPlayedLeaderRow[];
    roundsPlayed: number;
};

type ResultsStats = {
    votesCast: number;
    votesAvailable: number;
    /** Everyone who joined, of everyone expected: the team plus the guests who joined. */
    participation: { participants: number; expected: number };
    durationSeconds: number | null;
};

export type Results = {
    participants: BoardParticipant[];
    health: HealthResults | null;
    healthTrend: HealthTrendPoint[] | null;
    surveys: SurveyPayload[];
    games: GamesPlayed | null;
    roti: RotiResults;
    summary: ResultsSummary | null;
    deliveries: IntegrationDelivery[];
    emailRecipients: { participants: number; team: number } | null;
    stats: ResultsStats;
};
