import { describe, expect, it } from 'vitest';
import {
    deltaSincePrevious,
    healthScale,
    toMoodPoints,
    toRotiPoints,
} from '@/lib/teams/mood-adapter';
import type { TeamMoodPoint } from '@/types';

function point(
    retroId: string,
    values: Partial<TeamMoodPoint> = {},
): TeamMoodPoint {
    return {
        retroId,
        title: `Retro ${retroId}`,
        completedAt: '2026-09-01T10:00:00+00:00',
        url: `/retros/${retroId}`,
        mood: null,
        moodVoters: 0,
        roti: null,
        rotiVoters: 0,
        ...values,
    };
}

const trend: TeamMoodPoint[] = [
    point('a', {
        roti: 4,
        rotiVoters: 3,
        completedAt: '2026-08-04T10:00:00+00:00',
    }),
    point('b', {
        mood: 6,
        moodVoters: 1,
        roti: 2.5,
        rotiVoters: 2,
        completedAt: '2026-08-18T10:00:00+00:00',
    }),
    point('c', { mood: 7.5, moodVoters: 2 }),
];

describe('toMoodPoints', () => {
    it('gives one point per retro that has a mood, in the order received', () => {
        expect(toMoodPoints(trend)).toEqual([
            {
                id: 'b',
                sprint: 'Retro b',
                mean: 6,
                voters: 1,
                href: '/retros/b',
            },
            {
                id: 'c',
                sprint: 'Retro c',
                mean: 7.5,
                voters: 2,
                href: '/retros/c',
            },
        ]);
    });

    it('gives nothing for a team without a health score', () => {
        expect(toMoodPoints([])).toEqual([]);
        expect(toMoodPoints([point('a', { roti: 4 })])).toEqual([]);
    });
});

describe('toRotiPoints', () => {
    it('gives one point per retro that has a ROTI, in the order received, labelled by the day it closed', () => {
        expect(toRotiPoints(trend, 'en')).toEqual([
            { id: 'a', label: 'Aug 4', title: 'Retro a', mean: 4 },
            { id: 'b', label: 'Aug 18', title: 'Retro b', mean: 2.5 },
        ]);
    });

    it('writes the day in the language of the page', () => {
        expect(toRotiPoints(trend, 'fr')[0].label).toBe('4 août');
    });

    it('gives nothing for a team without a ROTI', () => {
        expect(toRotiPoints([], 'en')).toEqual([]);
        expect(toRotiPoints([point('a', { mood: 6 })], 'en')).toEqual([]);
    });
});

describe('deltaSincePrevious', () => {
    it('is the change of the last point since the one before, to one decimal', () => {
        expect(deltaSincePrevious(toMoodPoints(trend))).toBe(1.5);
        expect(
            deltaSincePrevious([
                { sprint: 'a', mean: 4.1 },
                { sprint: 'b', mean: 4.3 },
            ]),
        ).toBe(0.2);
        expect(
            deltaSincePrevious([
                { sprint: 'a', mean: 4 },
                { sprint: 'b', mean: 2.5 },
            ]),
        ).toBe(-1.5);
    });

    it('is null under two points', () => {
        expect(deltaSincePrevious([])).toBeNull();
        expect(deltaSincePrevious([{ sprint: 'a', mean: 4 }])).toBeNull();
    });
});

describe('healthScale', () => {
    it('starts at 0 so that the ticks of a score out of 10 are whole numbers', () => {
        expect(healthScale).toEqual({ min: 0, max: 10 });
    });
});
