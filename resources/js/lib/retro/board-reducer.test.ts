import { describe, expect, it } from 'vitest';
import { boardReducer } from './board-reducer';
import type { Snapshot } from './types';

const board = {
    writersCount: 1,
    roti: { myScore: 3, respondents: 1, voterIds: ['a'] },
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
