import type {
    SurveyComparison,
    SurveyQuestionPayload,
    SurveyResults,
    SurveySnapshot,
} from '@/lib/surveys/types';

type Overrides = {
    survey?: Partial<SurveySnapshot['survey']>;
    me?: Partial<SurveySnapshot['me']>;
    progress?: Partial<SurveySnapshot['progress']>;
    questions?: SurveyQuestionPayload[];
    results?: SurveyResults | null;
    comparable?: SurveySnapshot['comparable'];
};

function question(
    overrides: Partial<SurveyQuestionPayload> &
        Pick<SurveyQuestionPayload, 'id' | 'kind' | 'label' | 'position'>,
): SurveyQuestionPayload {
    return {
        shortLabel: null,
        description: null,
        isRequired: false,
        allowsComment: false,
        scaleMax: null,
        scaleLabels: null,
        isBuiltin: false,
        options: [],
        myAnswer: null,
        ...overrides,
    };
}

/** The five questions of the mockup's results frame. */
export const mockupQuestions: SurveyQuestionPayload[] = [
    question({
        id: 'q-scale',
        kind: 'scale',
        label: 'Workload of the sprint',
        position: 0,
        allowsComment: true,
        scaleMax: 5,
        scaleLabels: ['Unbearable', 'Very comfortable'],
    }),
    question({
        id: 'q-nps',
        kind: 'nps',
        label: 'Would you recommend the team?',
        position: 1,
    }),
    question({
        id: 'q-single',
        kind: 'single',
        label: 'Which ritual must we keep?',
        position: 2,
        options: [
            { id: 'o-retro', label: 'Retrospective' },
            { id: 'o-daily', label: 'Daily' },
            { id: 'o-poker', label: 'Planning poker' },
            { id: 'o-review', label: 'Sprint review' },
        ],
    }),
    question({
        id: 'q-multiple',
        kind: 'multiple',
        label: 'What slowed you down?',
        position: 3,
        options: [
            { id: 'o-meetings', label: 'Too many meetings' },
            { id: 'o-payment', label: 'Payment team dependency' },
            { id: 'o-staging', label: 'Staging environment' },
            { id: 'o-specs', label: 'Vague specs' },
        ],
    }),
    question({
        id: 'q-text',
        kind: 'text',
        label: 'A word for the team?',
        position: 4,
        myAnswer: {
            value: null,
            optionIds: [],
            text: 'Fewer meetings on Monday, please.',
            comment: null,
        },
    }),
];

const texts = [
    'Fewer meetings on Monday, please.',
    'Friday releases stress me out.',
    'Good teamwork, we finally met the goal.',
    'Keep the Thursday pair programming!',
    'Thanks Malik for the help on the Postgres migration.',
    'Too many meetings, not enough focus.',
    'We shipped on time.',
];

/** Nine answers on the five kinds: mean 3.8, NPS +22, "5 · 56%", "6 · 67%", seven texts. */
export const mockupResults: SurveyResults = {
    belowThreshold: false,
    responses: 9,
    questions: {
        'q-scale': {
            responses: 9,
            mean: 3.8,
            mode: 4,
            buckets: [
                { key: '1', label: '1', count: 0 },
                { key: '2', label: '2', count: 1 },
                { key: '3', label: '3', count: 2 },
                { key: '4', label: '4', count: 4 },
                { key: '5', label: '5', count: 2 },
            ],
            comments: [
                { id: 'c-1', text: 'Heavy but fine.', isMine: false },
                { id: 'c-2', text: 'Too many tickets.', isMine: true },
            ],
        },
        'q-nps': {
            responses: 9,
            nps: 22,
            detractors: 2,
            passives: 3,
            promoters: 4,
            buckets: Array.from({ length: 11 }, (_, value) => ({
                key: String(value),
                label: String(value),
                count: [0, 0, 0, 0, 0, 1, 1, 2, 1, 2, 2][value],
            })),
            comments: [],
        },
        'q-single': {
            responses: 9,
            options: [
                { id: 'o-retro', label: 'Retrospective', count: 5 },
                { id: 'o-daily', label: 'Daily', count: 2 },
                { id: 'o-poker', label: 'Planning poker', count: 1 },
                { id: 'o-review', label: 'Sprint review', count: 1 },
            ],
        },
        'q-multiple': {
            responses: 9,
            options: [
                { id: 'o-meetings', label: 'Too many meetings', count: 6 },
                { id: 'o-payment', label: 'Payment team dependency', count: 5 },
                { id: 'o-staging', label: 'Staging environment', count: 4 },
                { id: 'o-specs', label: 'Vague specs', count: 3 },
            ],
        },
        'q-text': {
            responses: 7,
            answers: texts.map((text, index) => ({
                id: `t-${index + 1}`,
                text,
                isMine: index === 0,
            })),
        },
    },
};

/** A survey of the team Atlas, open, seen by its editor: nine answers out of eleven. */
export function surveySnapshot(overrides: Overrides = {}): SurveySnapshot {
    return {
        survey: {
            id: 'survey-1',
            title: 'Team pulse — sprint 42',
            description: null,
            status: 'open',
            template: null,
            hasLockedQuestions: false,
            teamId: 'team-1',
            teamName: 'Atlas',
            retroId: null,
            facilitatorName: 'Arnaud Ritti',
            guestAccessEnabled: true,
            guestUrl: 'https://skrum.test/surveys/join/token-1',
            oneQuestionAtATime: true,
            showResultsAfterAnswer: false,
            resultsThreshold: 3,
            version: 4,
            openedAt: '2026-10-01T09:00:00+00:00',
            closedAt: null,
            ...overrides.survey,
        },
        me: {
            id: 'respondent-1',
            name: 'Arnaud Ritti',
            avatarUrl: '/avatars/a.svg',
            isGuest: false,
            isEditor: true,
            hasSubmitted: true,
            canSeeResults: true,
            ...overrides.me,
        },
        questions: overrides.questions ?? mockupQuestions,
        progress: {
            responses: 9,
            completed: 9,
            audience: 11,
            ...overrides.progress,
        },
        results:
            overrides.results === undefined ? mockupResults : overrides.results,
        comparable:
            overrides.comparable === undefined
                ? { defaultId: null, surveys: [] }
                : overrides.comparable,
        links: {
            team: '/workspaces/w/teams/team-1',
            show: '/surveys/survey-1',
            results: '/surveys/survey-1/results',
            edit: '/surveys/survey-1/edit',
            healthCheck: null,
        },
        serverTime: '2026-10-03T08:00:00.000Z',
    };
}

/** The closed surveys of the team Atlas that the results may compare with, Sprint 41 by default. */
export const mockupComparable: NonNullable<SurveySnapshot['comparable']> = {
    defaultId: 'survey-41',
    surveys: [
        {
            id: 'survey-41',
            title: 'Sprint 41',
            closedAt: '2026-09-19T16:00:00+00:00',
        },
        {
            id: 'survey-40',
            title: 'Sprint 40',
            closedAt: '2026-09-05T16:00:00+00:00',
        },
    ],
};

/** The mockup's survey against Sprint 41: +0.4 on the scale, +11 on NPS. */
export const mockupComparison: SurveyComparison = {
    other: {
        id: 'survey-41',
        title: 'Sprint 41',
        closedAt: '2026-09-19T16:00:00+00:00',
    },
    belowThreshold: false,
    pairs: [
        {
            questionId: 'q-scale',
            otherQuestionId: 'q41-scale',
            kind: 'scale',
            label: 'Workload of the sprint',
            current: { mean: 3.8, responses: 9 },
            other: { mean: 3.4, responses: 8 },
            delta: 0.4,
        },
        {
            questionId: 'q-nps',
            otherQuestionId: 'q41-nps',
            kind: 'nps',
            label: 'Would you recommend the team?',
            current: { nps: 22, responses: 9 },
            other: { nps: 11, responses: 8 },
            delta: 11,
        },
        {
            questionId: 'q-single',
            otherQuestionId: 'q41-single',
            kind: 'single',
            label: 'Which ritual must we keep?',
            current: {
                responses: 9,
                options: [
                    { id: 'o-retro', label: 'Retrospective', percent: 56 },
                    { id: 'o-daily', label: 'Daily', percent: 22 },
                ],
            },
            other: {
                responses: 8,
                options: [
                    { id: 'o41-retro', label: 'Retrospective', percent: 56 },
                    { id: 'o41-daily', label: 'Daily', percent: 32 },
                ],
            },
            delta: [
                { optionId: 'o-retro', label: 'Retrospective', delta: 0 },
                { optionId: 'o-daily', label: 'Daily', delta: -10 },
            ],
        },
        {
            questionId: 'q-text',
            otherQuestionId: 'q41-text',
            kind: 'text',
            label: 'A word for the team?',
            current: { responses: 7 },
            other: { responses: 5 },
            delta: 2,
        },
    ],
    onlyHere: [
        {
            questionId: 'q-multiple',
            label: 'What slowed you down?',
            kind: 'multiple',
        },
    ],
    onlyThere: [
        { questionId: 'q41-mood', label: 'Mood of the week', kind: 'scale' },
    ],
};
