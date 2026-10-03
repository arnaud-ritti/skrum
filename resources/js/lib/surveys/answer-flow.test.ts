import { describe, expect, it } from 'vitest';
import {
    digitRange,
    digitValue,
    firstUnanswered,
    missingRequired,
    stepOf,
} from './answer-flow';
import type { SurveyKind, SurveyQuestionPayload } from './types';

function question(
    id: string,
    kind: SurveyKind,
    overrides: Partial<SurveyQuestionPayload> = {},
): SurveyQuestionPayload {
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
        options: [],
        myAnswer: null,
        ...overrides,
    };
}

const answered = {
    myAnswer: { value: 4, optionIds: [], text: null, comment: null },
};

describe('firstUnanswered', () => {
    it('finds the first question without an answer', () => {
        expect(
            firstUnanswered([
                question('a', 'scale', answered),
                question('b', 'nps'),
                question('c', 'text'),
            ]),
        ).toBe(1);
    });

    it('stays on the last question when every question has an answer', () => {
        expect(
            firstUnanswered([
                question('a', 'scale', answered),
                question('b', 'nps', answered),
            ]),
        ).toBe(1);
    });

    it('starts at zero on an empty survey', () => {
        expect(firstUnanswered([])).toBe(0);
    });
});

describe('missingRequired', () => {
    it('names the required questions left without an answer, in order', () => {
        expect(
            missingRequired([
                question('a', 'scale', { isRequired: true }),
                question('b', 'nps', { isRequired: true, ...answered }),
                question('c', 'text'),
                question('d', 'single', { isRequired: true }),
            ]),
        ).toEqual(['a', 'd']);
    });

    it('reads the answers through the predicate it is given', () => {
        expect(
            missingRequired(
                [
                    question('a', 'scale', { isRequired: true }),
                    question('b', 'nps', { isRequired: true }),
                ],
                (asked) => asked.id === 'a',
            ),
        ).toEqual(['b']);
    });
});

describe('stepOf', () => {
    const questions = [
        question('a', 'scale'),
        question('b', 'nps'),
        question('c', 'text'),
    ];

    it('points at the first question named by a submission error', () => {
        expect(
            stepOf(
                {
                    'questions.c': ['An answer is required.'],
                    'questions.b': ['An answer is required.'],
                },
                questions,
            ),
        ).toBe(1);
    });

    it('is null when no error names a question of the survey', () => {
        expect(
            stepOf(
                {
                    survey: ['Answer at least one question before finishing.'],
                    'questions.z': ['An answer is required.'],
                },
                questions,
            ),
        ).toBeNull();
    });
});

describe('digitValue', () => {
    it('answers a scale of five with the digits one to five', () => {
        const scale = question('a', 'scale');

        expect(digitValue('1', scale)).toBe(1);
        expect(digitValue('5', scale)).toBe(5);
        expect(digitValue('7', scale)).toBeNull();
        expect(digitValue('0', scale)).toBeNull();
    });

    it('answers an NPS with the digits zero to nine, zero mapping to 0', () => {
        const nps = question('b', 'nps');

        expect(digitValue('0', nps)).toBe(0);
        expect(digitValue('9', nps)).toBe(9);
    });

    it('ignores anything that is not a digit, and the kinds without a scale', () => {
        expect(digitValue('a', question('a', 'scale'))).toBeNull();
        expect(digitValue('Enter', question('b', 'nps'))).toBeNull();
        expect(digitValue('1', question('c', 'single'))).toBeNull();
        expect(digitValue('1', question('d', 'multiple'))).toBeNull();
        expect(digitValue('1', question('e', 'text'))).toBeNull();
    });
});

describe('digitRange', () => {
    it('gives the keys of the hint: 1 to 5 on a scale, 0 to 9 on an NPS, none otherwise', () => {
        expect(digitRange(question('a', 'scale'))).toEqual([1, 5]);
        expect(digitRange(question('b', 'nps'))).toEqual([0, 9]);
        expect(digitRange(question('c', 'text'))).toBeNull();
    });
});
