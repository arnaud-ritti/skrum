import { describe, expect, it } from 'vitest';
import {
    actionDueState,
    daysUntil,
    formatDaysLeft,
    formatDueDay,
    localToday,
} from '@/lib/action-items/due';

const today = '2026-09-30';

describe('daysUntil', () => {
    it('counts whole days, across a month and backwards', () => {
        expect(daysUntil('2026-09-30', today)).toBe(0);
        expect(daysUntil('2026-10-03', today)).toBe(3);
        expect(daysUntil('2026-09-26', today)).toBe(-4);
    });
});

describe('actionDueState', () => {
    it('is done for a completed item, whatever its date', () => {
        expect(
            actionDueState(
                { status: 'completed', dueOn: '2026-09-01', isOverdue: false },
                today,
            ),
        ).toEqual({ state: 'done', days: null });
    });

    it('has no state without a due date', () => {
        expect(
            actionDueState(
                { status: 'open', dueOn: null, isOverdue: false },
                today,
            ).state,
        ).toBe('none');
    });

    it('takes the overdue flag from the server', () => {
        expect(
            actionDueState(
                { status: 'open', dueOn: '2026-09-26', isOverdue: true },
                today,
            ),
        ).toEqual({ state: 'overdue', days: -4 });
    });

    it('warns from three days before the date, the day itself included', () => {
        const state = (dueOn: string) =>
            actionDueState({ status: 'open', dueOn, isOverdue: false }, today)
                .state;

        expect(state('2026-09-30')).toBe('soon');
        expect(state('2026-10-03')).toBe('soon');
        expect(state('2026-10-04')).toBe('later');
    });
});

describe('formatting', () => {
    it('writes the day of the week with the date', () => {
        expect(formatDueDay('2026-10-09', 'en')).toBe('Fri, Oct 9');
        expect(formatDueDay('2026-10-09T22:30:00Z', 'en')).toBe('Fri, Oct 9');
    });

    it('writes the days left in words', () => {
        expect(formatDaysLeft(0, 'en')).toBe('today');
        expect(formatDaysLeft(1, 'en')).toBe('tomorrow');
        expect(formatDaysLeft(3, 'en')).toBe('in 3 days');
    });

    it('reads the local day of a date', () => {
        expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    });
});
