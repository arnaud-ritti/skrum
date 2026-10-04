import { describe, expect, it } from 'vitest';
import { formatDaysAgo } from '@/lib/days-ago';

const Now = Date.parse('2026-10-02T12:00:00Z');

describe('formatDaysAgo', () => {
    it('tells a date to the day, the week, the month or the year', () => {
        expect(formatDaysAgo('2026-10-02T08:00:00Z', 'en', Now)).toBe('today');
        expect(formatDaysAgo('2026-10-01T10:00:00Z', 'en', Now)).toBe(
            'yesterday',
        );
        expect(formatDaysAgo('2026-09-29T10:00:00Z', 'en', Now)).toBe(
            '3 days ago',
        );
        expect(formatDaysAgo('2026-09-18T10:00:00Z', 'en', Now)).toBe(
            '2 weeks ago',
        );
        expect(formatDaysAgo('2026-07-01T10:00:00Z', 'en', Now)).toBe(
            '3 months ago',
        );
        expect(formatDaysAgo('2024-09-01T10:00:00Z', 'en', Now)).toBe(
            '2 years ago',
        );
    });

    it('follows the language of the user', () => {
        expect(formatDaysAgo('2026-09-29T10:00:00Z', 'fr', Now)).toBe(
            'il y a 3 jours',
        );
    });

    it('never tells a date in the future', () => {
        expect(formatDaysAgo('2026-10-05T10:00:00Z', 'en', Now)).toBe('today');
    });
});
