import { describe, expect, it } from 'vitest';
import { boardReducer } from './board-reducer';
import type { Snapshot } from './types';

const board = {
    writersCount: 1,
    roti: { myScore: 3, respondents: 1, voterIds: ['a'], canVote: true },
} as unknown as Snapshot;

describe('boardReducer writers and ROTI voters', () => {
    it('sets the writers count', () => {
        const next = boardReducer(board, {
            type: 'writers.set',
            writersCount: 4,
        });

        expect(next.writersCount).toBe(4);
    });

    it('sets the voter ids and keeps the own score', () => {
        const next = boardReducer(board, {
            type: 'roti.set',
            respondents: 2,
            voterIds: ['a', 'b'],
        });

        expect(next.roti).toEqual({
            myScore: 3,
            respondents: 2,
            voterIds: ['a', 'b'],
            canVote: true,
        });
    });

    it('applies the own rating with the voter ids of the response', () => {
        const next = boardReducer(board, {
            type: 'roti.set',
            myScore: 5,
            respondents: 2,
            voterIds: ['a', 'me'],
        });

        expect(next.roti).toEqual({
            myScore: 5,
            respondents: 2,
            voterIds: ['a', 'me'],
            canVote: true,
        });
    });

    it('keeps the voter ids when the action carries none', () => {
        const next = boardReducer(board, {
            type: 'roti.set',
            respondents: 1,
            myScore: null,
        });

        expect(next.roti.voterIds).toEqual(['a']);
    });
});

describe('boardReducer health check', () => {
    const healthCheck = {
        surveyId: 'survey-1',
        isClosed: false,
        scale: 5,
        respondents: 1,
        participants: 3,
        hasSubmitted: false,
        statements: [
            {
                key: 'interaction',
                label: 'Interaction',
                text: 'Interaction with colleagues was productive',
                isBuiltin: true,
                myScore: null,
            },
            {
                key: 'vision',
                label: 'Vision',
                text: 'The vision and goals are clear to me',
                isBuiltin: true,
                myScore: null,
            },
        ],
    };
    const withHealth = { ...board, healthCheck } as unknown as Snapshot;
    const withoutHealth = {
        ...board,
        healthCheck: null,
    } as unknown as Snapshot;

    it('takes the counts of health.answered and nothing else', () => {
        const next = boardReducer(withHealth, {
            type: 'health.progress',
            respondents: 2,
            participants: 4,
        });

        expect(next.healthCheck).toEqual({
            ...healthCheck,
            respondents: 2,
            participants: 4,
        });
    });

    it('applies the own submission: the scores, sent, and the counts', () => {
        const next = boardReducer(withHealth, {
            type: 'health.submitted',
            scores: { interaction: 4, vision: 2 },
            respondents: 2,
            participants: 3,
        });

        expect(next.healthCheck).toMatchObject({
            surveyId: 'survey-1',
            isClosed: false,
            scale: 5,
            respondents: 2,
            participants: 3,
            hasSubmitted: true,
        });
        expect(
            next.healthCheck?.statements.map((statement) => statement.myScore),
        ).toEqual([4, 2]);
    });

    it('ignores both on a board without a health check', () => {
        expect(
            boardReducer(withoutHealth, {
                type: 'health.progress',
                respondents: 2,
                participants: 4,
            }),
        ).toBe(withoutHealth);
        expect(
            boardReducer(withoutHealth, {
                type: 'health.submitted',
                scores: { vision: 3 },
                respondents: 1,
                participants: 1,
            }),
        ).toBe(withoutHealth);
    });
});
