import type { ActionItem } from '@/lib/retro/types';

export type ActionDueState = 'done' | 'overdue' | 'soon' | 'later' | 'none';

/** A due date this close is shown as a warning, with the days left. */
export const DueSoonDays = 3;

const DayMs = 86_400_000;

function utcDay(iso: string): number {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);

    return Date.UTC(year, month - 1, day);
}

/** The day of the viewer, as the date inputs write it. */
export function localToday(now: Date = new Date()): string {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${now.getFullYear()}-${month}-${day}`;
}

export function daysUntil(dueOn: string, today: string): number {
    return Math.round((utcDay(dueOn) - utcDay(today)) / DayMs);
}

/**
 * What the Due cell of the table says. Whether an open item is overdue is
 * the server's word; the warning of the last days is counted here.
 */
export function actionDueState(
    item: Pick<ActionItem, 'status' | 'dueOn' | 'isOverdue'>,
    today: string,
): { state: ActionDueState; days: number | null } {
    if (item.status === 'completed') {
        return { state: 'done', days: null };
    }

    if (item.dueOn === null) {
        return { state: 'none', days: null };
    }

    const days = daysUntil(item.dueOn, today);

    if (item.isOverdue) {
        return { state: 'overdue', days };
    }

    if (days >= 0 && days <= DueSoonDays) {
        return { state: 'soon', days };
    }

    return { state: 'later', days };
}

/** "Fri 10 Oct": the day of the week tells how close the date is. */
export function formatDueDay(iso: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(utcDay(iso)));
}

/** "today", "tomorrow", "in 3 days", in the language of the viewer. */
export function formatDaysLeft(days: number, locale: string): string {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        days,
        'day',
    );
}
