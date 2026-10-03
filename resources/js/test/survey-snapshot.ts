import type {
    SurveyAnswer,
    SurveyKind,
    SurveyQuestionPayload,
    SurveySnapshot,
} from '@/lib/surveys/types';

export function surveyQuestion(
    id: string,
    kind: SurveyKind,
    overrides: Partial<SurveyQuestionPayload> = {},
): SurveyQuestionPayload {
    const isChoice = kind === 'single' || kind === 'multiple';

    return {
        id,
        kind,
        label: `Question ${id}`,
        shortLabel: null,
        description: null,
        position: 0,
        isRequired: false,
        allowsComment: false,
        scaleMax: kind === 'scale' ? 5 : kind === 'nps' ? 10 : null,
        scaleLabels: null,
        isBuiltin: false,
        options: isChoice
            ? [
                  { id: `${id}-1`, label: 'Daily' },
                  { id: `${id}-2`, label: 'Weekly' },
              ]
            : [],
        myAnswer: null,
        ...overrides,
    };
}

export function surveyAnswer(overrides: Partial<SurveyAnswer>): SurveyAnswer {
    return {
        value: null,
        optionIds: [],
        text: null,
        comment: null,
        ...overrides,
    };
}

type SnapshotOverrides = Omit<Partial<SurveySnapshot>, 'survey' | 'me'> & {
    survey?: Partial<SurveySnapshot['survey']>;
    me?: Partial<SurveySnapshot['me']>;
};

export function surveySnapshot(
    overrides: SnapshotOverrides = {},
): SurveySnapshot {
    const { survey, me, ...rest } = overrides;

    return {
        survey: {
            id: 's1',
            title: 'Team pulse',
            description: null,
            status: 'open',
            template: null,
            hasLockedQuestions: false,
            teamId: 't1',
            teamName: 'Atlas',
            retroId: null,
            facilitatorName: 'Fran',
            guestAccessEnabled: false,
            guestUrl: null,
            joinCode: null,
            oneQuestionAtATime: true,
            showResultsAfterAnswer: true,
            resultsThreshold: 3,
            version: 4,
            openedAt: '2026-10-19T09:00:00.000Z',
            closedAt: null,
            savedAt: '2026-10-19T08:55:00.000Z',
            ...survey,
        },
        me: {
            id: 'r1',
            name: 'Mia Lopez',
            avatarUrl: '/a.svg',
            isGuest: false,
            isEditor: false,
            hasSubmitted: false,
            canSeeResults: false,
            ...me,
        },
        questions: [
            surveyQuestion('a', 'scale', { position: 0 }),
            surveyQuestion('b', 'nps', { position: 1 }),
        ],
        progress: { responses: 4, completed: 3, audience: 11 },
        results: null,
        comparable: null,
        links: {
            team: '/teams/t1',
            show: '/surveys/s1',
            results: '/surveys/s1/results',
            edit: null,
            healthCheck: null,
        },
        serverTime: '2026-10-19T10:00:00.000Z',
        ...rest,
    };
}
