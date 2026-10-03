export type SurveyStatus = 'draft' | 'open' | 'closed';

export type SurveyKind = 'scale' | 'nps' | 'single' | 'multiple' | 'text';

export type SurveyAnswer = {
    value: number | null;
    optionIds: string[];
    text: string | null;
    comment: string | null;
};

export type SurveyOptionPayload = { id: string; label: string };

export type SurveyQuestionPayload = {
    id: string;
    kind: SurveyKind;
    label: string;
    shortLabel: string | null;
    description: string | null;
    position: number;
    isRequired: boolean;
    allowsComment: boolean;
    scaleMax: number | null;
    scaleLabels: [string | null, string | null] | null;
    isBuiltin: boolean;
    options: SurveyOptionPayload[];
    myAnswer: SurveyAnswer | null;
};

export type SurveyBucket = { key: string; label: string; count: number };

export type SurveyTextEntry = { id: string; text: string; isMine: boolean };

export type SurveyQuestionSummary = {
    responses: number;
    mean?: number | null;
    mode?: number | null;
    nps?: number | null;
    detractors?: number;
    passives?: number;
    promoters?: number;
    buckets?: SurveyBucket[];
    options?: { id: string; label: string; count: number }[];
    answers?: SurveyTextEntry[];
    comments?: SurveyTextEntry[];
};

export type SurveyResults = {
    belowThreshold: boolean;
    responses: number;
    questions: Record<string, SurveyQuestionSummary>;
};

export type SurveyProgress = {
    responses: number;
    completed: number;
    audience: number;
};

export type SurveyComparable = {
    defaultId: string | null;
    surveys: { id: string; title: string; closedAt: string | null }[];
};

export type SurveySnapshot = {
    survey: {
        id: string;
        title: string;
        description: string | null;
        status: SurveyStatus;
        template: 'health_check' | 'team_pulse' | null;
        hasLockedQuestions: boolean;
        teamId: string;
        teamName: string | null;
        retroId: string | null;
        facilitatorName: string | null;
        guestAccessEnabled: boolean;
        guestUrl: string | null;
        joinCode: string | null;
        oneQuestionAtATime: boolean;
        showResultsAfterAnswer: boolean;
        resultsThreshold: number;
        version: number;
        openedAt: string | null;
        closedAt: string | null;
        /** The last time the survey or one of its questions was saved. */
        savedAt: string | null;
    };
    me: {
        id: string;
        name: string;
        avatarUrl: string;
        isGuest: boolean;
        isEditor: boolean;
        hasSubmitted: boolean;
        canSeeResults: boolean;
    };
    questions: SurveyQuestionPayload[];
    progress: SurveyProgress;
    results: SurveyResults | null;
    comparable: SurveyComparable | null;
    links: {
        team: string | null;
        show: string;
        results: string;
        edit: string | null;
        /** The team's statements, for a survey whose questions come from them. */
        healthCheck: string | null;
    };
    serverTime: string;
};

/** The difference of one option of this survey, in percentage points. */
export type SurveyOptionDelta = {
    optionId: string;
    label: string;
    delta: number;
};

export type SurveyComparisonPair = {
    questionId: string;
    otherQuestionId: string;
    kind: SurveyKind;
    label: string;
    current: Record<string, unknown>;
    other: Record<string, unknown>;
    delta: number | SurveyOptionDelta[] | null;
};

export type SurveyComparison = {
    other: { id: string; title: string; closedAt: string | null };
    belowThreshold: boolean;
    pairs: SurveyComparisonPair[];
    onlyHere: { questionId: string; label: string; kind: SurveyKind }[];
    onlyThere: { questionId: string; label: string; kind: SurveyKind }[];
};

export type TeamSurveySummary = {
    id: string;
    title: string;
    status: SurveyStatus;
    template: string | null;
    questionCount: number;
    responseCount: number;
    updatedAt: string | null;
    closedAt: string | null;
    facilitatorName: string | null;
    canManage: boolean;
    url: string;
};

export type SurveyTemplateOption = {
    key: 'health_check' | 'team_pulse' | null;
    name: string;
    description: string;
    questionCount: number;
};
