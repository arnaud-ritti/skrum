import { describe, expect, it } from 'vitest';
import { surveyReducer } from './survey-reducer';
import type { SurveyQuestionPayload, SurveySnapshot } from './types';

function question(
    id: string,
    position: number,
    overrides: Partial<SurveyQuestionPayload> = {},
): SurveyQuestionPayload {
    return {
        id,
        kind: 'scale',
        label: `Question ${id}`,
        shortLabel: null,
        description: null,
        position,
        isRequired: false,
        allowsComment: false,
        scaleMax: 5,
        scaleLabels: [null, null],
        isBuiltin: false,
        options: [],
        myAnswer: null,
        ...overrides,
    };
}

function snapshot(overrides: Partial<SurveySnapshot> = {}): SurveySnapshot {
    return {
        survey: {
            id: 's1',
            title: 'Pulse',
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
            oneQuestionAtATime: true,
            showResultsAfterAnswer: true,
            resultsThreshold: 3,
            version: 4,
            openedAt: null,
            closedAt: null,
            savedAt: null,
        },
        me: {
            id: 'r1',
            name: 'Me',
            avatarUrl: '/a.svg',
            isGuest: false,
            isEditor: false,
            hasSubmitted: false,
            canSeeResults: false,
        },
        questions: [question('a', 0), question('b', 1)],
        progress: { responses: 0, completed: 0, audience: 11 },
        results: null,
        comparable: null,
        links: {
            team: '/t',
            show: '/s',
            results: '/r',
            edit: null,
            healthCheck: null,
        },
        serverTime: '2026-10-19T10:00:00.000Z',
        ...overrides,
    };
}

describe('surveyReducer', () => {
    it('sets and clears the own answer of one question, and takes the counts that came with it', () => {
        const answered = surveyReducer(snapshot(), {
            type: 'answer.set',
            questionId: 'b',
            answer: { value: 4, optionIds: [], text: null, comment: null },
            progress: { responses: 1, completed: 0, audience: 11 },
        });

        expect(answered.questions[1].myAnswer?.value).toBe(4);
        expect(answered.questions[0].myAnswer).toBeNull();
        expect(answered.progress.responses).toBe(1);

        const cleared = surveyReducer(answered, {
            type: 'answer.set',
            questionId: 'b',
            answer: null,
        });

        expect(cleared.questions[1].myAnswer).toBeNull();
        expect(cleared.progress.responses).toBe(1);
    });

    it('moves the counters and the audience from an event, as a whole', () => {
        const next = surveyReducer(snapshot(), {
            type: 'progress.set',
            responses: 7,
            completed: 5,
            audience: 13,
        });

        expect(next.progress).toEqual({
            responses: 7,
            completed: 5,
            audience: 13,
        });
    });

    it('replaces the snapshot, except with one older than what it holds', () => {
        const current = snapshot();
        const older = snapshot({
            survey: { ...current.survey, version: 3, title: 'Stale' },
        });
        const newer = snapshot({
            survey: { ...current.survey, version: 5, title: 'Fresh' },
        });

        expect(
            surveyReducer(current, {
                type: 'snapshot.replace',
                snapshot: older,
            }).survey.title,
        ).toBe('Pulse');
        expect(
            surveyReducer(current, {
                type: 'snapshot.replace',
                snapshot: newer,
            }).survey.title,
        ).toBe('Fresh');
    });

    it('adds, replaces, removes and reorders questions, keeping positions in step', () => {
        const added = surveyReducer(snapshot(), {
            type: 'question.upsert',
            question: question('c', 2),
        });
        expect(added.questions.map((item) => item.id)).toEqual(['a', 'b', 'c']);

        const replaced = surveyReducer(added, {
            type: 'question.upsert',
            question: question('b', 1, { label: 'Renamed' }),
        });
        expect(replaced.questions[1].label).toBe('Renamed');

        const reordered = surveyReducer(replaced, {
            type: 'question.reorder',
            ids: ['c', 'a', 'b'],
        });
        expect(reordered.questions.map((item) => item.id)).toEqual([
            'c',
            'a',
            'b',
        ]);
        expect(reordered.questions.map((item) => item.position)).toEqual([
            0, 1, 2,
        ]);

        const removed = surveyReducer(reordered, {
            type: 'question.remove',
            questionId: 'a',
        });
        expect(removed.questions.map((item) => item.position)).toEqual([0, 1]);
    });

    it('inserts a duplicated question right after the position it carries', () => {
        const next = surveyReducer(snapshot(), {
            type: 'question.upsert',
            question: question('copy', 1),
        });

        expect(next.questions.map((item) => item.id)).toEqual([
            'a',
            'copy',
            'b',
        ]);
    });
});
