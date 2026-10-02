import { describe, expect, it } from 'vitest';
import {
    canSubmitSurveyAnswer,
    hasAnsweredSurvey,
    orderedOptionIds,
    savedSurveyAnswer,
    savedSurveyAnswerKey,
    toSurveyQuestionProps,
} from './survey-question-adapter';
import type { BoardParticipant, SurveyPayload } from './types';

const participants: BoardParticipant[] = [
    { id: 'alice', name: 'Alice Martin', avatarUrl: '/a.svg', isGuest: false },
    { id: 'bob', name: 'Bob Stone', avatarUrl: '/b.svg', isGuest: true },
];

function survey(overrides: Partial<SurveyPayload> = {}): SurveyPayload {
    return {
        id: 'survey-1',
        kind: 'single',
        question: 'How was the sprint?',
        description: null,
        position: 0,
        isClosed: false,
        version: 1,
        showVoters: false,
        responseCount: 2,
        myOptionIds: [],
        myText: null,
        resultsVisible: false,
        options: [
            {
                id: 'great',
                label: 'Great',
                position: 0,
                count: null,
                voters: null,
            },
            { id: 'ok', label: 'OK', position: 1, count: null, voters: null },
            { id: 'bad', label: 'Bad', position: 2, count: null, voters: null },
        ],
        textAnswers: null,
        reactions: [],
        commentCount: 0,
        comments: [],
        ...overrides,
    };
}

const answer = { participants, mode: 'answer' } as const;
const results = { participants, mode: 'results' } as const;

describe('toSurveyQuestionProps', () => {
    it('maps the question, its options and the state of the survey', () => {
        const props = toSurveyQuestionProps(
            survey({ description: 'Be honest.', isClosed: true }),
            answer,
        );

        expect(props).toMatchObject({
            id: 'survey-1',
            kind: 'single',
            label: 'How was the sprint?',
            description: 'Be honest.',
            mode: 'answer',
            closed: true,
            hasAnswered: false,
            value: null,
            maxLength: 500,
        });
        expect(props.options?.map((option) => option.label)).toEqual([
            'Great',
            'OK',
            'Bad',
        ]);
    });

    it('never produces a count, a voter or an answer while the results are hidden', () => {
        const leaking = survey({
            resultsVisible: false,
            options: [
                {
                    id: 'great',
                    label: 'Great',
                    position: 0,
                    count: 2,
                    voters: ['alice'],
                },
            ],
        });
        const props = toSurveyQuestionProps(leaking, answer);

        expect(props.options).toEqual([
            { id: 'great', label: 'Great', count: null, voters: null },
        ]);
        expect(props.results).toEqual({
            responses: 2,
            hidden: true,
            textAnswers: undefined,
        });

        const text = toSurveyQuestionProps(
            survey({
                kind: 'text',
                options: [],
                resultsVisible: false,
                textAnswers: [
                    {
                        id: 't1',
                        text: 'Secret',
                        authorId: 'bob',
                        isMine: false,
                    },
                ],
            }),
            answer,
        );

        expect(text.results?.hidden).toBe(true);
        expect(text.results?.textAnswers).toBeUndefined();
    });

    it('lists the options without figures in the results of someone who never answered', () => {
        const unanswered = survey({
            resultsVisible: false,
            responseCount: 2,
            options: [
                {
                    id: 'great',
                    label: 'Great',
                    position: 0,
                    count: 2,
                    voters: ['alice'],
                },
            ],
        });
        const props = toSurveyQuestionProps(unanswered, results);

        expect(props.options).toEqual([
            { id: 'great', label: 'Great', count: null, voters: null },
        ]);
        expect(props.results).toEqual({
            responses: 2,
            hidden: false,
            textAnswers: undefined,
        });

        const text = toSurveyQuestionProps(
            survey({
                kind: 'text',
                options: [],
                resultsVisible: false,
                textAnswers: [
                    {
                        id: 't1',
                        text: 'Secret',
                        authorId: 'bob',
                        isMine: false,
                    },
                ],
            }),
            results,
        );

        expect(text.results?.hidden).toBe(false);
        expect(text.results?.textAnswers).toEqual([]);
    });

    it('gives the counts once the results are visible', () => {
        const props = toSurveyQuestionProps(
            survey({
                resultsVisible: true,
                myOptionIds: ['ok'],
                options: [
                    {
                        id: 'great',
                        label: 'Great',
                        position: 0,
                        count: 1,
                        voters: null,
                    },
                    {
                        id: 'ok',
                        label: 'OK',
                        position: 1,
                        count: 1,
                        voters: null,
                    },
                ],
            }),
            answer,
        );

        expect(props.options?.map((option) => option.count)).toEqual([1, 1]);
        expect(props.options?.every((option) => option.voters === null)).toBe(
            true,
        );
        expect(props.results).toMatchObject({ responses: 2, hidden: false });
        expect(props.value).toBe('ok');
        expect(props.hasAnswered).toBe(true);
    });

    it('maps the voters only when the payload names them, and only who is in the retro', () => {
        const props = toSurveyQuestionProps(
            survey({
                resultsVisible: true,
                showVoters: true,
                options: [
                    {
                        id: 'great',
                        label: 'Great',
                        position: 0,
                        count: 2,
                        voters: ['bob', 'gone'],
                    },
                    {
                        id: 'ok',
                        label: 'OK',
                        position: 1,
                        count: 0,
                        voters: [],
                    },
                ],
            }),
            answer,
        );

        expect(props.options?.[0].voters).toEqual([
            { id: 'bob', name: 'Bob Stone', avatarUrl: '/b.svg' },
        ]);
        expect(props.options?.[1].voters).toEqual([]);
    });

    it('names the author of a text answer only when the payload does', () => {
        const props = toSurveyQuestionProps(
            survey({
                kind: 'text',
                options: [],
                resultsVisible: true,
                myText: 'Mine',
                textAnswers: [
                    { id: 't1', text: 'Mine', authorId: null, isMine: true },
                    { id: 't2', text: 'Named', authorId: 'bob', isMine: false },
                    { id: 't3', text: 'Left', authorId: 'gone', isMine: false },
                ],
            }),
            answer,
        );

        expect(props.results?.textAnswers).toEqual([
            { id: 't1', text: 'Mine', isMine: true, authorName: null },
            { id: 't2', text: 'Named', isMine: false, authorName: 'Bob Stone' },
            { id: 't3', text: 'Left', isMine: false, authorName: null },
        ]);
        expect(props.value).toBe('Mine');
    });

    it('gives an empty list of answers to the results of a text survey nobody answered', () => {
        const visible = survey({
            kind: 'text',
            options: [],
            resultsVisible: true,
            textAnswers: null,
        });

        expect(
            toSurveyQuestionProps(visible, results).results?.textAnswers,
        ).toEqual([]);
        expect(
            toSurveyQuestionProps(visible, answer).results?.textAnswers,
        ).toBeUndefined();
    });

    it('gives the ticked options of a multiple-choice survey in the order of the survey', () => {
        const props = toSurveyQuestionProps(
            survey({ kind: 'multiple', myOptionIds: ['bad', 'great'] }),
            answer,
        );

        expect(props.value).toEqual(['great', 'bad']);
    });
});

describe('the answer of a viewer', () => {
    it('knows who has answered', () => {
        expect(hasAnsweredSurvey(survey())).toBe(false);
        expect(hasAnsweredSurvey(survey({ myOptionIds: ['ok'] }))).toBe(true);
        expect(hasAnsweredSurvey(survey({ kind: 'text', myText: 'Hi' }))).toBe(
            true,
        );
    });

    it('starts a draft from the saved answer', () => {
        expect(savedSurveyAnswer(survey({ kind: 'text' }))).toBe('');
        expect(savedSurveyAnswer(survey({ kind: 'text', myText: 'Hi' }))).toBe(
            'Hi',
        );
        expect(
            savedSurveyAnswer(
                survey({ kind: 'multiple', myOptionIds: ['ok', 'great'] }),
            ),
        ).toEqual(['great', 'ok']);
    });

    it('changes its key when the saved answer or the kind changes', () => {
        const before = savedSurveyAnswerKey(survey({ kind: 'multiple' }));

        expect(
            savedSurveyAnswerKey(
                survey({ kind: 'multiple', myOptionIds: ['ok'] }),
            ),
        ).not.toBe(before);
        expect(savedSurveyAnswerKey(survey({ kind: 'text' }))).not.toBe(before);
        expect(savedSurveyAnswerKey(survey({ kind: 'multiple' }))).toBe(before);
    });

    it('orders a selection as the survey orders its options', () => {
        expect(orderedOptionIds(survey(), ['bad', 'unknown', 'great'])).toEqual(
            ['great', 'bad'],
        );
    });

    it('sends a selection only when it holds something new', () => {
        const answered = survey({ kind: 'multiple', myOptionIds: ['great'] });

        expect(canSubmitSurveyAnswer(answered, [])).toBe(false);
        expect(canSubmitSurveyAnswer(answered, ['great'])).toBe(false);
        expect(canSubmitSurveyAnswer(answered, ['ok', 'great'])).toBe(true);
        expect(
            canSubmitSurveyAnswer(survey({ kind: 'multiple' }), ['ok']),
        ).toBe(true);
    });

    it('sends a text only when it is not blank and not the saved one', () => {
        const answered = survey({ kind: 'text', myText: 'Hi' });

        expect(canSubmitSurveyAnswer(answered, '   ')).toBe(false);
        expect(canSubmitSurveyAnswer(answered, ' Hi ')).toBe(false);
        expect(canSubmitSurveyAnswer(answered, 'Hello')).toBe(true);
    });
});
