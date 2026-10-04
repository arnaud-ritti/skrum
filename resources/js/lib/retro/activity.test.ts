import { describe, expect, it } from 'vitest';
import {
    activityLabel,
    applyActivity,
    kindsShownIn,
    liveActivity,
    othersWriting,
    parseActivity,
    WritingCountTtlMs,
} from './activity';

describe('parseActivity', () => {
    it('reads a well-formed message and nothing else', () => {
        expect(
            parseActivity({ kind: 'writing', targetId: 'col', active: true }),
        ).toEqual({ kind: 'writing', targetId: 'col', active: true });
        expect(
            parseActivity({ kind: 'shouting', targetId: 'col', active: true }),
        ).toBeNull();
        expect(parseActivity({ kind: 'writing', active: true })).toBeNull();
        expect(parseActivity('writing')).toBeNull();
    });
});

describe('kindsShownIn', () => {
    it('shows writing in Writing, moving in Writing and Grouping, notes in Discussing', () => {
        expect(kindsShownIn('writing', false)).toEqual(['writing', 'moving']);
        expect(kindsShownIn('grouping', false)).toEqual(['moving']);
        expect(kindsShownIn('discussing', false)).toEqual(['notes']);
        expect(kindsShownIn('voting', false)).toEqual([]);
    });

    it('never takes a writing client event on an anonymous retro (the count goes through the server)', () => {
        expect(kindsShownIn('writing', true)).toEqual(['moving']);
    });
});

describe('othersWriting', () => {
    const at = (count: number, receivedAt: number) => ({ count, receivedAt });

    it('leaves the viewer out of the count', () => {
        expect(othersWriting(at(3, 0), true, 1000)).toBe(2);
        expect(othersWriting(at(3, 0), false, 1000)).toBe(3);
        expect(othersWriting(at(1, 0), true, 1000)).toBe(0);
        expect(othersWriting(at(0, 0), true, 1000)).toBe(0);
    });

    it('drops a count that has not been refreshed for eight seconds', () => {
        expect(othersWriting(at(2, 0), false, WritingCountTtlMs - 1)).toBe(2);
        expect(othersWriting(at(2, 0), false, WritingCountTtlMs)).toBe(0);
        expect(othersWriting(null, false, 0)).toBe(0);
    });
});

describe('applyActivity and liveActivity', () => {
    it('adds an entry, refreshes it, and removes it when it ends', () => {
        const started = applyActivity(
            [],
            'p1',
            { kind: 'writing', targetId: 'col', active: true },
            1000,
        );
        const refreshed = applyActivity(
            started,
            'p1',
            { kind: 'writing', targetId: 'col', active: true },
            3000,
        );
        const ended = applyActivity(
            refreshed,
            'p1',
            { kind: 'writing', targetId: 'col', active: false },
            3500,
        );

        expect(started).toEqual([
            {
                senderId: 'p1',
                kind: 'writing',
                targetId: 'col',
                expiresAt: 6000,
            },
        ]);
        expect(refreshed).toHaveLength(1);
        expect(refreshed[0].expiresAt).toBe(8000);
        expect(ended).toEqual([]);
    });

    it('moves a writer to another column', () => {
        const first = applyActivity(
            [],
            'p1',
            { kind: 'writing', targetId: 'a', active: true },
            0,
        );
        const moved = applyActivity(
            first,
            'p1',
            { kind: 'writing', targetId: 'b', active: true },
            100,
        );

        expect(moved.map((entry) => entry.targetId)).toEqual(['b']);
    });

    it('forgets an entry five seconds after its last message', () => {
        const entries = applyActivity(
            [],
            'p1',
            { kind: 'moving', targetId: 'card', active: true },
            0,
        );

        expect(liveActivity(entries, 4999)).toHaveLength(1);
        expect(liveActivity(entries, 5000)).toHaveLength(0);
    });
});

describe('activityLabel', () => {
    const t = (key: string) => `t:${key}`;
    const member = { id: 'p1', name: 'Inès Bernard' };

    it('names an online member as the cursors do', () => {
        expect(activityLabel(member, false, t)).toBe('Inès Bernard');
    });

    it('says "Participant" on an anonymous retro or for someone not online', () => {
        expect(activityLabel(member, true, t)).toBe('t:Participant');
        expect(activityLabel(undefined, false, t)).toBe('t:Participant');
    });
});
