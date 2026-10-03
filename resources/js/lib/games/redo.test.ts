import { describe, expect, it } from 'vitest';
import { findTime, foundByTotal, popRedo, pushUndone } from './redo';
import type { DrawingOp } from './types';

const stroke: DrawingOp = {
    type: 'stroke',
    color: 'black',
    size: 10,
    points: [
        [1, 2],
        [3, 4],
    ],
};

describe('the redo list', () => {
    it('gives back what was undone last, and empties', () => {
        const { op, rest } = popRedo(pushUndone([], stroke));

        expect(op).toEqual(stroke);
        expect(rest).toEqual([]);
    });

    it('has nothing to redo when empty', () => {
        expect(popRedo([])).toEqual({ op: null, rest: [] });
    });

    it('keeps the list when nothing was undone', () => {
        const stack = [stroke];

        expect(pushUndone(stack, undefined)).toBe(stack);
    });
});

describe('foundByTotal', () => {
    it('counts the guessers of the start, or more when a late player found', () => {
        expect(foundByTotal(2, 5)).toBe(5);
        expect(foundByTotal(3, 2)).toBe(3);
        expect(foundByTotal(1, null)).toBe(1);
    });
});

describe('findTime', () => {
    it('reads minutes and seconds', () => {
        expect(findTime(18)).toBe('0:18');
        expect(findTime(75)).toBe('1:15');
    });
});
