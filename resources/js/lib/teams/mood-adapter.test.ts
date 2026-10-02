import { describe, expect, it } from 'vitest';
import {
    deltaSincePrevious,
    moodScale,
    preferredMetric,
    toMoodPoints,
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
    point('a', { roti: 4, rotiVoters: 3 }),
    point('b', { mood: 6, moodVoters: 1, roti: 2.5, rotiVoters: 2 }),
    point('c', { mood: 7.5, moodVoters: 2 }),
];

describe('toMoodPoints', () => {
    it('gives one point per retro that has a mood, in the order received', () => {
        expect(toMoodPoints(trend, 'mood')).toEqual([
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

    it('gives one point per retro that has a ROTI, in the order received', () => {
        expect(toMoodPoints(trend, 'roti')).toEqual([
            {
                id: 'a',
                sprint: 'Retro a',
                mean: 4,
                voters: 3,
                href: '/retros/a',
            },
            {
                id: 'b',
                sprint: 'Retro b',
                mean: 2.5,
                voters: 2,
                href: '/retros/b',
            },
        ]);
    });

    it('gives nothing for a team without data', () => {
        expect(toMoodPoints([], 'mood')).toEqual([]);
        expect(toMoodPoints([point('a')], 'roti')).toEqual([]);
    });
});

describe('deltaSincePrevious', () => {
    it('is the change of the last point since the one before, to one decimal', () => {
        expect(deltaSincePrevious(toMoodPoints(trend, 'mood'))).toBe(1.5);
        expect(deltaSincePrevious(toMoodPoints(trend, 'roti'))).toBe(-1.5);
        expect(
            deltaSincePrevious([
                { sprint: 'a', mean: 4.1 },
                { sprint: 'b', mean: 4.3 },
            ]),
        ).toBe(0.2);
    });

    it('is null under two points', () => {
        expect(deltaSincePrevious([])).toBeNull();
        expect(deltaSincePrevious([{ sprint: 'a', mean: 4 }])).toBeNull();
    });
});

describe('moodScale', () => {
    it('is the health check scale for the mood and the ROTI scale of the chart otherwise', () => {
        expect(moodScale('mood')).toEqual({ min: 0, max: 10 });
        expect(moodScale('roti')).toBeUndefined();
    });
});

describe('preferredMetric', () => {
    it('is the mood, unless only the ROTI has data', () => {
        expect(preferredMetric(trend)).toBe('mood');
        expect(preferredMetric([])).toBe('mood');
        expect(preferredMetric([point('a', { roti: 4, rotiVoters: 3 })])).toBe(
            'roti',
        );
    });
});
