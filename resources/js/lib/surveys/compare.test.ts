import { describe, expect, it } from 'vitest';
import { deltasByQuestion, signed } from './compare';
import type { SurveyComparison, SurveyComparisonPair } from './types';

function pair(
    overrides: Partial<SurveyComparisonPair> &
        Pick<SurveyComparisonPair, 'questionId' | 'kind' | 'delta'>,
): SurveyComparisonPair {
    return {
        otherQuestionId: `${overrides.questionId}-before`,
        label: overrides.questionId,
        current: {},
        other: {},
        ...overrides,
    };
}

function comparison(
    overrides: Partial<SurveyComparison> = {},
): SurveyComparison {
    return {
        other: { id: 'survey-0', title: 'Sprint 41', closedAt: null },
        belowThreshold: false,
        pairs: [
            pair({ questionId: 'q-scale', kind: 'scale', delta: 0.4 }),
            pair({ questionId: 'q-nps', kind: 'nps', delta: 11 }),
            pair({
                questionId: 'q-single',
                kind: 'single',
                delta: [{ optionId: 'o-daily', label: 'Daily', delta: 10 }],
            }),
            pair({ questionId: 'q-text', kind: 'text', delta: 2 }),
            pair({ questionId: 'q-empty', kind: 'scale', delta: null }),
        ],
        onlyHere: [],
        onlyThere: [],
        ...overrides,
    };
}

describe('signed', () => {
    it('writes a rise with a plus sign', () => {
        expect(signed(1.5, 1)).toBe('+1.5');
    });

    it('writes a fall with the minus sign U+2212', () => {
        expect(signed(-0.6, 1)).toBe('−0.6');
    });

    it('writes no difference as 0', () => {
        expect(signed(0)).toBe('0');
    });

    it('writes a difference that rounds to nothing as 0, without a sign', () => {
        expect(signed(0.04, 1)).toBe('0');
        expect(signed(-0.04, 1)).toBe('0');
    });

    it('gives null when there is no difference to show', () => {
        expect(signed(null)).toBeNull();
    });
});

describe('deltasByQuestion', () => {
    it('keeps the scale and NPS pairs that have a number, against the other title', () => {
        expect(deltasByQuestion(comparison())).toEqual({
            'q-scale': { value: 0.4, against: 'Sprint 41' },
            'q-nps': { value: 11, against: 'Sprint 41' },
        });
    });

    it('is empty below the threshold', () => {
        expect(deltasByQuestion(comparison({ belowThreshold: true }))).toEqual(
            {},
        );
    });

    it('is empty without a comparison', () => {
        expect(deltasByQuestion(null)).toEqual({});
    });
});
