import { describe, expect, it } from 'vitest';
import {
    addDays,
    newSprintDefaults,
    previewNextRetro,
    zonedNow,
} from './sprint-planning';

const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const sprint41 = {
    id: 's41',
    number: 41,
    startsOn: '2026-09-07',
    endsOn: '2026-09-20',
};
const sprint42 = {
    id: 's42',
    number: 42,
    startsOn: '2026-09-21',
    endsOn: '2026-10-04',
};
const sprint43 = {
    id: 's43',
    number: 43,
    startsOn: '2026-10-05',
    endsOn: '2026-10-18',
};
const thursday = 4;

describe('previewNextRetro', () => {
    it('finds the last Thursday of the current sprint', () => {
        expect(
            previewNextRetro(
                [sprint43, sprint42, sprint41],
                thursday,
                '14:00',
                new Date(2026, 8, 30, 10, 0),
                viewerZone,
            ),
        ).toEqual({ date: '2026-10-01', time: '14:00' });
    });

    it('moves to the next sprint once the retro of the day is past its time', () => {
        expect(
            previewNextRetro(
                [sprint43, sprint42, sprint41],
                thursday,
                '14:00',
                new Date(2026, 9, 1, 15, 0),
                viewerZone,
            ),
        ).toEqual({ date: '2026-10-15', time: '14:00' });
    });

    it('keeps the retro of the day before its time', () => {
        expect(
            previewNextRetro(
                [sprint43, sprint42],
                thursday,
                '14:00',
                new Date(2026, 9, 1, 13, 59),
                viewerZone,
            ),
        ).toEqual({ date: '2026-10-01', time: '14:00' });
    });

    it('keeps the retro of the day all day without a time', () => {
        expect(
            previewNextRetro(
                [sprint43, sprint42],
                thursday,
                null,
                new Date(2026, 9, 1, 23, 0),
                viewerZone,
            ),
        ).toEqual({ date: '2026-10-01', time: null });
    });

    it('has none without the next sprint', () => {
        expect(
            previewNextRetro(
                [sprint42, sprint41],
                thursday,
                '14:00',
                new Date(2026, 9, 1, 15, 0),
                viewerZone,
            ),
        ).toBeNull();
    });

    it('has none without a retro day', () => {
        expect(
            previewNextRetro(
                [sprint43, sprint42],
                null,
                null,
                new Date(2026, 8, 30, 10, 0),
                viewerZone,
            ),
        ).toBeNull();
    });

    it('skips a sprint shorter than a week without the retro weekday', () => {
        const short = {
            id: 's44',
            number: 44,
            startsOn: '2026-10-19',
            endsOn: '2026-10-20',
        };

        expect(
            previewNextRetro(
                [short],
                thursday,
                null,
                new Date(2026, 9, 19, 9, 0),
                viewerZone,
            ),
        ).toBeNull();
    });

    it('reads only the current sprint and the next one', () => {
        const days = (id: string, startsOn: string, endsOn: string) => ({
            id,
            number: 0,
            startsOn,
            endsOn,
        });

        expect(
            previewNextRetro(
                [
                    days('s44', '2026-10-19', '2026-10-20'),
                    days('s45', '2026-10-23', '2026-10-24'),
                    days('s46', '2026-10-26', '2026-11-08'),
                ],
                thursday,
                null,
                new Date(2026, 9, 19, 9, 0),
                viewerZone,
            ),
        ).toBeNull();
    });

    it('reads the day and the clock in the app time zone, not the viewer one', () => {
        expect(
            previewNextRetro(
                [sprint43],
                thursday,
                '14:00',
                new Date('2026-10-15T13:30:00Z'),
                'UTC',
            ),
        ).toEqual({ date: '2026-10-15', time: '14:00' });
        expect(
            previewNextRetro(
                [sprint43],
                thursday,
                '14:00',
                new Date('2026-10-15T13:30:00Z'),
                'Europe/Paris',
            ),
        ).toBeNull();
    });
});

describe('newSprintDefaults', () => {
    it('starts the day after the latest sprint and lasts the default length', () => {
        expect(
            newSprintDefaults([sprint43, sprint42], 44, 2, '2026-09-30'),
        ).toEqual({
            number: 44,
            startsOn: '2026-10-19',
            endsOn: '2026-11-01',
        });
    });

    it('starts today without any sprint', () => {
        expect(newSprintDefaults([], 1, 1, '2026-09-30')).toEqual({
            number: 1,
            startsOn: '2026-09-30',
            endsOn: '2026-10-06',
        });
    });
});

describe('day helpers', () => {
    it('reads the day and the clock of a moment in a time zone', () => {
        expect(zonedNow(new Date('2026-09-30T22:30:00Z'), 'UTC')).toEqual({
            day: '2026-09-30',
            clock: '22:30',
        });
        expect(
            zonedNow(new Date('2026-09-30T22:30:00Z'), 'Europe/Paris'),
        ).toEqual({ day: '2026-10-01', clock: '00:30' });
    });

    it('adds days across a month end', () => {
        expect(addDays('2026-09-30', 2)).toBe('2026-10-02');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });
});
