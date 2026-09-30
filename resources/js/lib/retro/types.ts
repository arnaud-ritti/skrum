import type { IntegrationDelivery, ShareAvailability } from '@/types';

export type RetroPhase =
    | 'health_check'
    | 'icebreaker'
    | 'writing'
    | 'grouping'
    | 'voting'
    | 'discussing'
    | 'completed';
export type ColumnColor =
    | 'green'
    | 'red'
    | 'blue'
    | 'amber'
    | 'purple'
    | 'slate';

export type CardSentiment = 'positive' | 'neutral' | 'negative';

export type SummaryStatus = 'pending' | 'ready' | 'failed';

export type ResultsSummary = {
    text: string | null;
    generatedAt: string | null;
    status: SummaryStatus | null;
    provider: string;
};

export type RetroTheme = { id: string; name: string; cardIds: string[] };

export type SuggestedActionStatus = 'pending' | 'promoted' | 'rejected';

export type SuggestedAction = {
    id: string;
    content: string;
    themeId: string | null;
    status: SuggestedActionStatus;
    actionItemId: string | null;
};

export type Insights = {
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

export type SurveyOption = {
    id: string;
    label: string;
    position: number;
    count: number | null;
    voters: string[] | null;
};

export type SurveyTextAnswer = {
    id: string;
    text: string;
    authorId: string | null;
    isMine: boolean;
};

export type SurveyComment = Omit<CardComment, 'cardId'> & { surveyId: string };

export type SurveyCommentThread = SurveyComment & { replies: SurveyComment[] };

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

export type ActionItemSubtask = {
    id: string;
    content: string;
    isCompleted: boolean;
    position: number;
};

export type ActionItemStatus = 'open' | 'completed';

export type ActionItemPerson = { name: string; avatarUrl: string };

export type ActionItemAssignee = ActionItemPerson & {
    kind: 'member' | 'guest';
    id: string;
    isTeamMember: boolean;
};

export type ActionItemSource = {
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

export type TeamMember = {
    id: string;
    name: string;
    avatarUrl: string;
    participantId: string | null;
};

export type TransferCandidate = { userId: string; name: string };

export type HealthStatementPayload = {
    key: string;
    label: string;
    text: string;
    isBuiltin: boolean;
};

export type HealthProgress = {
    key: string;
    count: number;
    answeredBy: string[];
};

export type HealthCheckStatement = HealthStatementPayload &
    HealthProgress & { myScore: number | null };

export type HealthCheckState = { statements: HealthCheckStatement[] };

export type Snapshot = {
    retro: {
        id: string;
        teamId: string;
        title: string;
        template: string;
        phase: RetroPhase;
        phases: RetroPhase[];
        healthCheckEnabled: boolean;
        icebreakerEnabled: boolean;
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
    teamMembers: TeamMember[];
    surveys: SurveyPayload[];
    roti: RotiState;
    results: Results | null;
    insights: Insights | null;
    features: { llm: boolean; llmProvider: string | null };
    healthCheck: HealthCheckState | null;
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
};

export type HealthStatementResult = {
    key: string;
    label: string;
    text: string;
    isBuiltin: boolean;
    average: number | null;
    count: number;
};

export type HealthHighlight = { key: string; label: string; average: number };

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
    retroId: string;
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

export type RotiState = { myScore: number | null; respondents: number };

export type Results = {
    participants: BoardParticipant[];
    health: HealthResults | null;
    healthTrend: HealthTrendPoint[] | null;
    surveys: SurveyPayload[];
    games: null;
    roti: RotiResults;
    summary: ResultsSummary | null;
    deliveries: IntegrationDelivery[];
    emailRecipients: { participants: number; team: number } | null;
};
