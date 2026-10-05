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

describe('boardReducer facilitation', () => {
    const base = {
        retro: {
            timerEndsAt: '2026-10-21T10:00:00Z',
            timerPausedSeconds: null,
            topicSeconds: 300,
        },
        voting: { finishedIds: [] },
        cards: [
            { id: 'a', discussedAt: null },
            { id: 'b', discussedAt: null },
        ],
        topicNotes: [{ cardId: 'a', body: 'old', version: 2, updatedAt: null }],
    } as unknown as Snapshot;

    it('pauses the timer and keeps the time per topic when the event does not say it', () => {
        const next = boardReducer(base, {
            type: 'timer.set',
            timerEndsAt: null,
            timerPausedSeconds: 42,
        });

        expect(next.retro).toMatchObject({
            timerEndsAt: null,
            timerPausedSeconds: 42,
            topicSeconds: 300,
        });
    });

    it('keeps the paused seconds when an older caller sends the end only', () => {
        const paused = boardReducer(base, {
            type: 'timer.set',
            timerEndsAt: null,
            timerPausedSeconds: 42,
        });
        const next = boardReducer(paused, {
            type: 'timer.set',
            timerEndsAt: '2026-10-21T10:05:00Z',
        });

        expect(next.retro.timerPausedSeconds).toBe(42);
    });

    it('sets who has finished voting', () => {
        const next = boardReducer(base, {
            type: 'voting.finished',
            finishedIds: ['p1', 'p2'],
        });

        expect(next.voting.finishedIds).toEqual(['p1', 'p2']);
    });

    it('marks and unmarks a topic discussed', () => {
        const marked = boardReducer(base, {
            type: 'topic.discussed',
            cardId: 'b',
            discussedAt: '2026-10-21T10:01:00Z',
        });
        const unmarked = boardReducer(marked, {
            type: 'topic.discussed',
            cardId: 'b',
            discussedAt: null,
        });

        expect(marked.cards[1].discussedAt).toBe('2026-10-21T10:01:00Z');
        expect(unmarked.cards[1].discussedAt).toBeNull();
    });

    it('adds a note, replaces it with a newer version, and ignores an older one', () => {
        const added = boardReducer(base, {
            type: 'topicNote.set',
            note: { cardId: 'b', body: 'new', version: 1, updatedAt: null },
        });
        const newer = boardReducer(added, {
            type: 'topicNote.set',
            note: { cardId: 'a', body: 'newer', version: 3, updatedAt: null },
        });
        const older = boardReducer(newer, {
            type: 'topicNote.set',
            note: { cardId: 'a', body: 'stale', version: 2, updatedAt: null },
        });

        expect(added.topicNotes).toHaveLength(2);
        expect(newer.topicNotes.find((n) => n.cardId === 'a')?.body).toBe(
            'newer',
        );
        expect(older).toBe(newer);
    });
});

describe('boardReducer survey reactions', () => {
    it('sets the reactions of one survey and keeps the rest of it', () => {
        const withSurveys = {
            surveys: [
                { id: 'survey-1', commentCount: 3, reactions: [] },
                { id: 'survey-2', commentCount: 0, reactions: [] },
            ],
        } as unknown as Snapshot;
        const reactions = [
            { emoji: '👍', count: 1, mine: true, names: ['Alice Martin'] },
        ];

        const next = boardReducer(withSurveys, {
            type: 'survey.reactions',
            surveyId: 'survey-1',
            reactions,
        });

        expect(next.surveys).toEqual([
            { id: 'survey-1', commentCount: 3, reactions },
            { id: 'survey-2', commentCount: 0, reactions: [] },
        ]);
    });
});
