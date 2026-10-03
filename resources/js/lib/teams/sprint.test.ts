import { describe, expect, it } from 'vitest';
import {
    calendarDay,
    formatDay,
    formatShortDay,
    formatTime,
    nextRetroLabel,
    retroNamePrefill,
    sprintRange,
    sprintTitle,
} from './sprint';

const t = (key: string, replace: Record<string, string | number> = {}) =>
    Object.entries(replace).reduce(
        (text, [name, value]) => text.replace(`:${name}`, String(value)),
        key,
    );

describe('sprint helpers', () => {
    it('reads a day as midnight UTC', () => {
        expect(calendarDay('2026-10-01').toISOString()).toBe(
            '2026-10-01T00:00:00.000Z',
        );
    });

    it('formats a day with its weekday in the locale', () => {
        expect(formatDay('2026-10-01', 'en-GB')).toBe('Thu 1 Oct');
        expect(formatDay('2026-10-01', 'fr')).toBe('jeu. 1 oct.');
    });

    it('formats a time without its minutes on the hour', () => {
        expect(formatTime('14:00', 'en')).toBe('2 PM');
        expect(formatTime('14:00', 'fr')).toBe('14 h');
        expect(formatTime('09:30', 'fr')).toBe('9:30');
    });

    it('names a sprint and its range', () => {
        expect(sprintTitle({ number: 42 }, t)).toBe('Sprint 42');
        expect(formatShortDay('2026-09-21', 'en-GB')).toBe('21 Sept');
        expect(
            sprintRange(
                { startsOn: '2026-09-21', endsOn: '2026-10-04' },
                'en-GB',
            ),
        ).toBe('21 Sept → 4 Oct');
    });

    it('labels the next retro with its time only when one is set', () => {
        expect(
            nextRetroLabel({ date: '2026-10-01', time: null }, 'en-GB', t),
        ).toBe('Next retro Thu 1 Oct');
        expect(
            nextRetroLabel({ date: '2026-10-01', time: '14:00' }, 'en-GB', t),
        ).toBe('Next retro Thu 1 Oct, 14');
    });

    it('proposes a retro name inside a sprint only', () => {
        expect(retroNamePrefill(null, t)).toBeUndefined();
        expect(retroNamePrefill(42, t)).toBe('Sprint 42 retro');
    });
});
