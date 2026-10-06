import { describe, expect, it } from 'vitest';
import type { TeamActivityLine } from '@/types';
import { dayBefore, groupByDay } from './activity-days';

const t = (key: string): string => key;

function line(id: string, day: string): TeamActivityLine {
    return {
        id,
        kind: 'member_joined',
        actor: { name: 'Ada Admin', avatarUrl: null },
        subject: null,
        at: `${day}T09:00:00+00:00`,
        day,
    };
}

describe('groupByDay', () => {
    it('groups the lines under Today, Yesterday and a date', () => {
        const groups = groupByDay(
            [
                line('a', '2026-10-06'),
                line('b', '2026-10-06'),
                line('c', '2026-10-05'),
                line('d', '2026-10-03'),
                line('e', '2025-12-31'),
            ],
            '2026-10-06',
            'en',
            t,
        );

        expect(
            groups.map((group) => [
                group.day,
                group.label,
                group.lines.map((each) => each.id),
            ]),
        ).toEqual([
            ['2026-10-06', 'Today', ['a', 'b']],
            ['2026-10-05', 'Yesterday', ['c']],
            ['2026-10-03', 'Oct 3', ['d']],
            ['2025-12-31', 'Dec 31, 2025', ['e']],
        ]);
    });

    it('writes the date in the locale of the page', () => {
        const [group] = groupByDay(
            [line('a', '2026-10-03')],
            '2026-10-06',
            'fr',
            t,
        );

        expect(group.label).toBe('3 oct.');
    });

    it('finds yesterday across a month and a year', () => {
        expect(dayBefore('2026-03-01')).toBe('2026-02-28');
        expect(dayBefore('2026-01-01')).toBe('2025-12-31');
    });
});
