import { describe, expect, it } from 'vitest';
import { SessionTabs, sessionMeta, sessionsHref } from './sessions';
import type { TeamSession } from './sessions';

const t = (key: string, replace: Record<string, string | number> = {}) =>
    Object.entries(replace).reduce(
        (text, [name, value]) => text.replace(`:${name}`, String(value)),
        key,
    );

const base: TeamSession = {
    kind: 'retro',
    id: '1',
    title: 'R',
    url: '/r',
    state: 'live',
    updatedAt: '2026-10-02T10:00:00+00:00',
    isDraft: false,
    phase: 'Writing',
    people: 9,
    tasks: null,
    facilitator: null,
    answers: null,
    game: null,
};

describe('sessionMeta', () => {
    it('describes each kind as the mockup does', () => {
        expect(sessionMeta(base, t)).toBe('Retro · Writing · 9 people');
        expect(sessionMeta({ ...base, kind: 'poker', tasks: 12 }, t)).toBe(
            'Planning poker · 12 tasks',
        );
        expect(
            sessionMeta(
                { ...base, kind: 'whiteboard', facilitator: 'Inès' },
                t,
            ),
        ).toBe('Whiteboard · Facilitated by Inès');
        expect(sessionMeta({ ...base, kind: 'survey', answers: 7 }, t)).toBe(
            'Poll · 7 answers',
        );
        expect(
            sessionMeta({ ...base, kind: 'icebreaker', game: 'Hangman' }, t),
        ).toBe('Icebreaker · Hangman');
    });

    it('drops a part the row does not have', () => {
        expect(
            sessionMeta({ ...base, kind: 'whiteboard', facilitator: null }, t),
        ).toBe('Whiteboard');
    });
});

describe('sessionsHref', () => {
    it('leads to the tab of the team, and to the page after a cursor', () => {
        expect(SessionTabs).toEqual(['upcoming', 'live', 'finished']);
        expect(sessionsHref('nordlys', 'team-1', 'finished')).toBe(
            '/w/nordlys/teams/team-1/sessions?tab=finished',
        );
        expect(sessionsHref('nordlys', 'team-1', 'live', 'abc')).toBe(
            '/w/nordlys/teams/team-1/sessions?tab=live&before=abc',
        );
    });
});
