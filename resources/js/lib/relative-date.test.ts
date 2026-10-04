import { describe, expect, it } from 'vitest';
import { formatDaysAgo } from '@/lib/relative-date';

const Now = new Date(2026, 9, 2, 12).getTime();

function at(year: number, month: number, day: number, hour = 10): string {
    return new Date(year, month - 1, day, hour).toISOString();
}

describe('formatDaysAgo', () => {
    it('tells a date to the day, the week, the month or the year, on the clock of the viewer', () => {
        expect(formatDaysAgo(at(2026, 10, 2, 8), 'en', Now)).toBe('today');
        expect(formatDaysAgo(at(2026, 10, 1, 23), 'en', Now)).toBe('yesterday');
        expect(formatDaysAgo(at(2026, 9, 29), 'en', Now)).toBe('3 days ago');
        expect(formatDaysAgo(at(2026, 9, 18), 'en', Now)).toBe('2 weeks ago');
        expect(formatDaysAgo(at(2026, 7, 1), 'en', Now)).toBe('3 months ago');
        expect(formatDaysAgo(at(2024, 9, 1), 'en', Now)).toBe('2 years ago');
    });

    it('says last year from 360 days, never 12 months', () => {
        expect(formatDaysAgo(at(2025, 10, 7), 'en', Now)).toBe('last year');
    });

    it('follows the language of the user', () => {
        expect(formatDaysAgo(at(2026, 9, 29), 'fr', Now)).toBe(
            'il y a 3 jours',
        );
    });

    it('never tells a date in the future', () => {
        expect(formatDaysAgo(at(2026, 10, 5), 'en', Now)).toBe('today');
    });

    it('tells nothing for a date that does not parse', () => {
        expect(formatDaysAgo('not a date', 'en', Now)).toBe('');
    });
});
