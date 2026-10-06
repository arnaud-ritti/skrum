import type { SessionType } from '@/components/skrum/session-type-picker';
import type { Translate } from '@/hooks/use-trans';
import { formatDecimal } from '@/lib/surveys/format';
import type { RecentSessionRow } from '@/types';

/** The session type that paints a row: a game room is an icebreaker. */
export function sessionType(row: RecentSessionRow): SessionType {
    return row.kind === 'game' ? 'icebreaker' : row.kind;
}

function cardsLabel(count: number, t: Translate): string {
    return count === 1 ? t('1 card') : t(':count cards', { count });
}

function tasksLabel(count: number, t: Translate): string {
    return count === 1 ? t('1 task') : t(':count tasks', { count });
}

function questionsLabel(count: number, t: Translate): string {
    return count === 1 ? t('1 question') : t(':count questions', { count });
}

export function sessionMeta(row: RecentSessionRow, t: Translate): string {
    switch (row.kind) {
        case 'retro':
            return [
                t('Retro'),
                row.meta.phaseLabel,
                cardsLabel(row.meta.cards ?? 0, t),
            ]
                .filter(Boolean)
                .join(' · ');
        case 'poker':
            return [
                t('Planning poker'),
                tasksLabel(row.meta.tasks ?? 0, t),
            ].join(' · ');
        case 'whiteboard':
            return row.meta.facilitatorName
                ? `${t('Whiteboard')} · ${t('Facilitated by :name', { name: row.meta.facilitatorName })}`
                : t('Whiteboard');
        case 'survey':
            return [
                t('Survey'),
                questionsLabel(row.meta.questions ?? 0, t),
            ].join(' · ');
        case 'game':
            return [t('Icebreaker'), row.meta.gameLabel]
                .filter(Boolean)
                .join(' · ');
    }
}

function outcomeCount(row: RecentSessionRow, t: Translate): string | null {
    if (row.outcome === null) {
        return null;
    }

    const { kind, count } = row.outcome;

    switch (kind) {
        case 'actions':
            return count === 1 ? t('1 action') : t(':count actions', { count });
        case 'answers':
            return count === 1 ? t('1 answer') : t(':count answers', { count });
        case 'estimated':
            return count === 1
                ? t('1 estimated')
                : t(':count estimated', { count });
    }
}

/** What the session produced: the ROTI of a retro that has one, then its count. */
export function sessionOutcome(
    row: RecentSessionRow,
    t: Translate,
): string | null {
    const outcome = [
        row.roti === null
            ? null
            : t('ROTI :roti', { roti: formatDecimal(row.roti) }),
        outcomeCount(row, t),
    ]
        .filter((part) => part !== null)
        .join(' · ');

    return outcome === '' ? null : outcome;
}

export function sessionStateLabel(row: RecentSessionRow, t: Translate): string {
    if (row.state === 'live') {
        return t('Live');
    }

    if (row.state === 'finished') {
        return t('Ended');
    }

    return row.kind === 'survey' ? t('Draft') : t('Upcoming');
}
