import { describe, expect, it } from 'vitest';
import type { RecentSessionRow } from '@/types';
import { sessionMeta, sessionOutcome, sessionStateLabel } from './session-rows';

const t = (key: string, replace: Record<string, string | number> = {}) =>
    Object.entries(replace).reduce(
        (text, [name, value]) => text.replace(`:${name}`, String(value)),
        key,
    );

const base: RecentSessionRow = {
    kind: 'retro',
    id: '1',
    title: 'Sprint 42 retro',
    url: '/r/1',
    state: 'live',
    updatedAt: '2026-10-02T10:00:00+00:00',
    participants: 6,
    meta: { phaseLabel: 'Voting', cards: 24 },
    outcome: null,
};

describe('sessionMeta', () => {
    it('describes a retro with its phase and cards', () => {
        expect(sessionMeta(base, t)).toBe('Retro · Voting · 24 cards');
        expect(sessionMeta({ ...base, meta: { cards: 1 } }, t)).toBe(
            'Retro · 1 card',
        );
    });

    it('describes a poker game with its tasks', () => {
        expect(
            sessionMeta({ ...base, kind: 'poker', meta: { tasks: 12 } }, t),
        ).toBe('Planning poker · 12 tasks');
        expect(
            sessionMeta({ ...base, kind: 'poker', meta: { tasks: 1 } }, t),
        ).toBe('Planning poker · 1 task');
    });

    it('describes a whiteboard with its facilitator when there is one', () => {
        expect(
            sessionMeta(
                {
                    ...base,
                    kind: 'whiteboard',
                    meta: { facilitatorName: 'Noa' },
                },
                t,
            ),
        ).toBe('Whiteboard · Facilitated by Noa');
        expect(
            sessionMeta(
                {
                    ...base,
                    kind: 'whiteboard',
                    meta: { facilitatorName: null },
                },
                t,
            ),
        ).toBe('Whiteboard');
    });

    it('describes a survey with its questions', () => {
        expect(
            sessionMeta({ ...base, kind: 'survey', meta: { questions: 5 } }, t),
        ).toBe('Survey · 5 questions');
        expect(
            sessionMeta({ ...base, kind: 'survey', meta: { questions: 1 } }, t),
        ).toBe('Survey · 1 question');
    });

    it('describes a game room with its game', () => {
        expect(
            sessionMeta(
                { ...base, kind: 'game', meta: { gameLabel: 'Two truths' } },
                t,
            ),
        ).toBe('Icebreaker · Two truths');
        expect(sessionMeta({ ...base, kind: 'game', meta: {} }, t)).toBe(
            'Icebreaker',
        );
    });
});

describe('sessionOutcome', () => {
    it('is nothing while a session has no outcome', () => {
        expect(sessionOutcome(base, t)).toBeNull();
    });

    it('counts actions, answers and estimated tasks', () => {
        const outcome = (
            kind: 'actions' | 'answers' | 'estimated',
            count: number,
        ) => sessionOutcome({ ...base, outcome: { kind, count } }, t);

        expect(outcome('actions', 1)).toBe('1 action');
        expect(outcome('actions', 2)).toBe('2 actions');
        expect(outcome('answers', 1)).toBe('1 answer');
        expect(outcome('answers', 2)).toBe('2 answers');
        expect(outcome('estimated', 1)).toBe('1 estimated');
        expect(outcome('estimated', 2)).toBe('2 estimated');
    });
});

describe('sessionStateLabel', () => {
    it('names the three states, and an upcoming survey a draft', () => {
        expect(sessionStateLabel(base, t)).toBe('Live');
        expect(sessionStateLabel({ ...base, state: 'finished' }, t)).toBe(
            'Ended',
        );
        expect(sessionStateLabel({ ...base, state: 'upcoming' }, t)).toBe(
            'Upcoming',
        );
        expect(
            sessionStateLabel(
                { ...base, kind: 'survey', state: 'upcoming' },
                t,
            ),
        ).toBe('Draft');
    });
});
