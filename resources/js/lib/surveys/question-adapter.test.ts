import { describe, expect, it } from 'vitest';
import { answerOf, toQuestionProps } from './question-adapter';
import type { SurveyQuestionPayload } from './types';

const base: SurveyQuestionPayload = {
    id: 'q1',
    kind: 'scale',
    label: 'Workload',
    shortLabel: null,
    description: null,
    position: 0,
    isRequired: true,
    allowsComment: true,
    scaleMax: 5,
    scaleLabels: ['Unbearable', 'Very comfortable'],
    isBuiltin: false,
    options: [],
    myAnswer: null,
};

describe('toQuestionProps', () => {
    it('maps a scale to the component kind, with its ends and the viewer answer', () => {
        const props = toQuestionProps(
            {
                ...base,
                myAnswer: {
                    value: 4,
                    optionIds: [],
                    text: null,
                    comment: 'ok',
                },
            },
            { mode: 'answer', index: 2, count: 5 },
        );

        expect(props.kind).toBe('scale5');
        expect(props.scaleLabels).toEqual(['Unbearable', 'Very comfortable']);
        expect(props.value).toBe(4);
        expect(props.comment).toBe('ok');
        expect(props.required).toBe(true);
        expect(props.index).toBe(2);
        expect(props.count).toBe(5);
        expect(props.anonymous).toBe(true);
    });

    it('shows a scale end set alone, the other end blank', () => {
        const props = toQuestionProps(
            { ...base, scaleLabels: ['Unbearable', null] },
            { mode: 'answer', index: 0, count: 1 },
        );
        const none = toQuestionProps(
            { ...base, scaleLabels: [null, null] },
            { mode: 'answer', index: 0, count: 1 },
        );

        expect(props.scaleLabels).toEqual(['Unbearable', '']);
        expect(none.scaleLabels).toBeUndefined();
    });

    it('gives a single choice its option id and a multiple choice its list', () => {
        const options = [
            { id: 'o1', label: 'A' },
            { id: 'o2', label: 'B' },
        ];
        const answer = {
            value: null,
            optionIds: ['o2'],
            text: null,
            comment: null,
        };

        expect(
            toQuestionProps(
                { ...base, kind: 'single', options, myAnswer: answer },
                { mode: 'answer' },
            ).value,
        ).toBe('o2');
        expect(
            toQuestionProps(
                { ...base, kind: 'multiple', options, myAnswer: answer },
                { mode: 'answer' },
            ).value,
        ).toEqual(['o2']);
        expect(
            toQuestionProps(
                { ...base, kind: 'multiple', options, myAnswer: null },
                { mode: 'answer' },
            ).value,
        ).toEqual([]);
    });

    it('never invents a count: without a summary the results are hidden', () => {
        const props = toQuestionProps(
            { ...base, kind: 'single', options: [{ id: 'o1', label: 'A' }] },
            { mode: 'results', responses: 4 },
        );

        expect(props.results).toEqual({ responses: 4, hidden: true });
        expect(props.options?.[0].count).toBeUndefined();
    });

    it('passes the summary of each kind through', () => {
        const nps = toQuestionProps(
            { ...base, kind: 'nps', scaleMax: null },
            {
                mode: 'results',
                summary: {
                    responses: 9,
                    nps: 22,
                    detractors: 2,
                    passives: 3,
                    promoters: 4,
                    buckets: [{ key: '0', label: '0', count: 0 }],
                    comments: [],
                },
            },
        );

        expect(nps.results).toMatchObject({
            responses: 9,
            nps: 22,
            segments: { detractors: 2, passives: 3, promoters: 4 },
        });

        const text = toQuestionProps(
            { ...base, kind: 'text' },
            {
                mode: 'results',
                summary: {
                    responses: 1,
                    answers: [{ id: 'a1', text: 'thanks', isMine: true }],
                },
            },
        );

        expect(text.results?.textAnswers).toEqual([
            { id: 'a1', text: 'thanks', isMine: true },
        ]);

        const choice = toQuestionProps(
            { ...base, kind: 'multiple', options: [{ id: 'o1', label: 'A' }] },
            {
                mode: 'results',
                summary: {
                    responses: 9,
                    options: [{ id: 'o1', label: 'A', count: 6 }],
                },
            },
        );

        expect(choice.options?.[0].count).toBe(6);
    });
});

describe('answerOf', () => {
    it('builds the request body of each kind and refuses an empty answer', () => {
        expect(answerOf(base, 4, 'because')).toEqual({
            value: 4,
            comment: 'because',
        });
        expect(answerOf({ ...base, allowsComment: false }, 4, 'x')).toEqual({
            value: 4,
        });
        expect(answerOf({ ...base, kind: 'nps' }, 0, '')).toEqual({ value: 0 });
        expect(answerOf({ ...base, kind: 'single' }, 'o1', '')).toEqual({
            optionId: 'o1',
        });
        expect(
            answerOf({ ...base, kind: 'multiple' }, ['o1', 'o2'], ''),
        ).toEqual({ optionIds: ['o1', 'o2'] });
        expect(answerOf({ ...base, kind: 'text' }, '  thanks  ', '')).toEqual({
            text: 'thanks',
        });
        expect(answerOf({ ...base, kind: 'text' }, '   ', '')).toBeNull();
        expect(answerOf({ ...base, kind: 'multiple' }, [], '')).toBeNull();
        expect(answerOf(base, null, '')).toBeNull();
    });
});
