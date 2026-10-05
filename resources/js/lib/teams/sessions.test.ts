import { describe, expect, it } from 'vitest';
import {
    SessionKinds,
    groupSessions,
    sessionMeta,
    sessionOutcome,
    sessionStatus,
    sessionsHref,
} from './sessions';
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
    sprint: null,
    roti: null,
    actions: null,
    points: null,
    canDelete: false,
    canDuplicate: false,
};

describe('sessionMeta', () => {
    it('counts one person, one task and one answer in the singular', () => {
        const said: string[] = [];
        const recording = (
            key: string,
            replace: Record<string, string | number> = {},
        ) => {
            said.push(key);

            return t(key, replace);
        };

        sessionMeta({ ...base, people: 1 }, recording);
        sessionMeta({ ...base, kind: 'poker', tasks: 1 }, recording);
        sessionOutcome(
            { ...base, kind: 'survey', answers: 1 },
            recording,
            'en',
        );

        expect(said).toEqual(
            expect.arrayContaining(['1 person', '1 task', '1 answer']),
        );
    });

    it('describes each kind, the answers of a poll left to its outcome', () => {
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
            'Poll',
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

    it('leaves the phase of a finished retro to its status', () => {
        expect(
            sessionMeta({ ...base, state: 'finished', phase: 'Completed' }, t),
        ).toBe('Retro · 9 people');
    });
});

describe('sessionOutcome', () => {
    it('tells what each kind produced, and nothing for a whiteboard', () => {
        expect(sessionOutcome({ ...base, roti: 4, actions: 2 }, t, 'en')).toBe(
            'ROTI 4.0 · 2 actions',
        );
        expect(
            sessionOutcome({ ...base, roti: null, actions: 1 }, t, 'en'),
        ).toBe('1 action');
        expect(
            sessionOutcome({ ...base, kind: 'poker', points: 34 }, t, 'en'),
        ).toBe('34 pts');
        expect(
            sessionOutcome({ ...base, kind: 'poker', points: null }, t, 'en'),
        ).toBeNull();
        expect(
            sessionOutcome({ ...base, kind: 'survey', answers: 7 }, t, 'en'),
        ).toBe('7 answers');
        expect(
            sessionOutcome({ ...base, kind: 'icebreaker', people: 1 }, t, 'en'),
        ).toBe('1 player');
        expect(
            sessionOutcome({ ...base, kind: 'icebreaker', people: 5 }, t, 'en'),
        ).toBe('5 players');
        expect(
            sessionOutcome({ ...base, kind: 'whiteboard' }, t, 'en'),
        ).toBeNull();
    });

    it('tells nothing of a session that has not started', () => {
        expect(
            sessionOutcome({ ...base, state: 'upcoming', actions: 0 }, t, 'en'),
        ).toBeNull();
    });

    it('writes the numbers as the locale does', () => {
        expect(
            sessionOutcome({ ...base, roti: 3.5, actions: null }, t, 'fr'),
        ).toBe('ROTI 3,5');
        expect(
            sessionOutcome({ ...base, kind: 'poker', points: 12.5 }, t, 'fr'),
        ).toBe('12,5 pts');
    });
});

describe('sessionStatus', () => {
    it('names the state of a row, a draft and a completed retro apart', () => {
        expect(sessionStatus({ ...base, state: 'upcoming' }, t)).toBe(
            'Not started',
        );
        expect(
            sessionStatus(
                { ...base, kind: 'survey', state: 'upcoming', isDraft: true },
                t,
            ),
        ).toBe('Draft');
        expect(sessionStatus(base, t)).toBe('Live');
        expect(sessionStatus({ ...base, state: 'finished' }, t)).toBe(
            'Completed',
        );
        expect(
            sessionStatus({ ...base, kind: 'poker', state: 'finished' }, t),
        ).toBe('Ended');
    });
});

describe('groupSessions', () => {
    const sprint = { number: 7, startsOn: '2026-09-28', endsOn: '2026-10-11' };
    const rows: TeamSession[] = [
        { ...base, id: 'a', sprint },
        {
            ...base,
            id: 'b',
            sprint: null,
            updatedAt: '2026-09-25T10:00:00+00:00',
        },
        {
            ...base,
            id: 'c',
            sprint: { ...sprint, number: 6 },
            updatedAt: '2026-09-20T10:00:00+00:00',
        },
        {
            ...base,
            id: 'd',
            sprint: null,
            updatedAt: '2026-08-12T10:00:00+00:00',
        },
    ];

    it('groups by sprint, with Outside a sprint for a row without one', () => {
        const groups = groupSessions(
            [rows[0], { ...base, id: 'a2', sprint }, ...rows.slice(1)],
            true,
            'en',
            t,
        );

        expect(groups.map((group) => group.label)).toEqual([
            'Sprint 7 · Sep 28 → Oct 11',
            'Outside a sprint',
            'Sprint 6 · Sep 28 → Oct 11',
        ]);
        expect(groups.map((group) => group.rows.map((row) => row.id))).toEqual([
            ['a', 'a2'],
            ['b', 'd'],
            ['c'],
        ]);
        expect(new Set(groups.map((group) => group.key)).size).toBe(3);
    });

    it('groups by month for a team without sprints', () => {
        const groups = groupSessions(rows, false, 'en', t);

        expect(groups.map((group) => group.label)).toEqual([
            'October 2026',
            'September 2026',
            'August 2026',
        ]);
        expect(groups.map((group) => group.rows.map((row) => row.id))).toEqual([
            ['a'],
            ['b', 'c'],
            ['d'],
        ]);
        expect(groupSessions(rows, false, 'fr', t)[0].label).toBe(
            'octobre 2026',
        );
    });
});

describe('sessionsHref', () => {
    it('leads to the sessions of the team, and to one kind of them', () => {
        expect(SessionKinds).toEqual([
            'retro',
            'poker',
            'whiteboard',
            'survey',
            'icebreaker',
        ]);
        expect(sessionsHref('nordlys', 'team-1')).toBe(
            '/w/nordlys/teams/team-1/sessions',
        );
        expect(sessionsHref('nordlys', 'team-1', { kind: 'poker' })).toBe(
            '/w/nordlys/teams/team-1/sessions?kind=poker',
        );
    });

    it('keeps the search of the page in the address', () => {
        expect(
            sessionsHref('nordlys', 'team-1', { kind: 'retro', q: 'sprint' }),
        ).toBe('/w/nordlys/teams/team-1/sessions?kind=retro&q=sprint');
        expect(sessionsHref('nordlys', 'team-1', { kind: null, q: null })).toBe(
            '/w/nordlys/teams/team-1/sessions',
        );
    });
});
