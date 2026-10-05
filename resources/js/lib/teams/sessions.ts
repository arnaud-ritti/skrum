import type { Translate } from '@/hooks/use-trans';
import TeamSessionsController from '@/actions/App/Http/Controllers/TeamSessionsController';
import type { SessionType } from '@/components/skrum/session-type-picker';
import { formatPoints } from '@/lib/poker/format';
import { sprintRange, sprintTitle } from '@/lib/teams/sprint';

/** The kinds of the chips, in the order of the session type picker. */
export const SessionKinds = [
    'retro',
    'poker',
    'whiteboard',
    'survey',
    'icebreaker',
] as const satisfies readonly SessionType[];

/** A row of `ListTeamSessions::timeline`: the fields a kind does not have are null. */
export type TeamSession = {
    kind: SessionType;
    id: string;
    title: string;
    url: string;
    state: 'upcoming' | 'live' | 'finished';
    updatedAt: string;
    isDraft: boolean;
    phase: string | null;
    people: number | null;
    tasks: number | null;
    facilitator: string | null;
    answers: number | null;
    game: string | null;
    /** The sprint that holds the last change of the session. */
    sprint: { number: number; startsOn: string; endsOn: string } | null;
    roti: number | null;
    actions: number | null;
    points: number | null;
    canDelete: boolean;
    canDuplicate: boolean;
};

export type SessionGroup = { key: string; label: string; rows: TeamSession[] };

export function sessionKindLabel(kind: SessionType, t: Translate): string {
    switch (kind) {
        case 'retro':
            return t('Retro');
        case 'poker':
            return t('Planning poker');
        case 'whiteboard':
            return t('Whiteboard');
        case 'survey':
            return t('Poll');
        case 'icebreaker':
            return t('Icebreaker');
    }
}

function kindParts(row: TeamSession, t: Translate): (string | null)[] {
    switch (row.kind) {
        case 'retro':
            return [
                row.state === 'finished' ? null : row.phase,
                row.people === null
                    ? null
                    : row.people === 1
                      ? t('1 person')
                      : t(':count people', { count: row.people }),
            ];
        case 'poker':
            return [
                row.tasks === null
                    ? null
                    : row.tasks === 1
                      ? t('1 task')
                      : t(':count tasks', { count: row.tasks }),
            ];
        case 'whiteboard':
            return [
                row.facilitator === null
                    ? null
                    : t('Facilitated by :name', { name: row.facilitator }),
            ];
        case 'survey':
            return [];
        case 'icebreaker':
            return [row.game];
    }
}

function joined(parts: (string | null)[]): string {
    return parts
        .filter((part): part is string => part !== null && part !== '')
        .join(' · ');
}

/** The meta line of a row: the kind, then what the kind tells of the session. */
export function sessionMeta(row: TeamSession, t: Translate): string {
    return joined([sessionKindLabel(row.kind, t), ...kindParts(row, t)]);
}

function outcomeParts(
    row: TeamSession,
    t: Translate,
    locale: string,
): (string | null)[] {
    switch (row.kind) {
        case 'retro':
            return [
                row.roti === null
                    ? null
                    : t('ROTI :roti', {
                          roti: new Intl.NumberFormat(locale, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                          }).format(row.roti),
                      }),
                row.actions === null
                    ? null
                    : row.actions === 1
                      ? t('1 action')
                      : t(':count actions', { count: row.actions }),
            ];
        case 'poker':
            return [
                row.points === null
                    ? null
                    : t(':points pts', {
                          points: formatPoints(row.points, locale),
                      }),
            ];
        case 'whiteboard':
            return [];
        case 'survey':
            return [
                row.answers === null
                    ? null
                    : row.answers === 1
                      ? t('1 answer')
                      : t(':count answers', { count: row.answers }),
            ];
        case 'icebreaker':
            return [
                row.people === null
                    ? null
                    : row.people === 1
                      ? t('1 player')
                      : t(':count players', { count: row.people }),
            ];
    }
}

/** What the session produced: null before it starts, and when its kind tells nothing. */
export function sessionOutcome(
    row: TeamSession,
    t: Translate,
    locale: string,
): string | null {
    if (row.state === 'upcoming') {
        return null;
    }

    const outcome = joined(outcomeParts(row, t, locale));

    return outcome === '' ? null : outcome;
}

export function sessionStatus(row: TeamSession, t: Translate): string {
    if (row.isDraft) {
        return t('Draft');
    }

    if (row.state === 'upcoming') {
        return t('Not started');
    }

    if (row.state === 'live') {
        return t('Live');
    }

    return row.kind === 'retro' ? t('Completed') : t('Ended');
}

/** The key and the heading of the group a row belongs to. */
function groupOf(
    row: TeamSession,
    hasSprints: boolean,
    locale: string,
    t: Translate,
): [key: string, label: string] {
    if (!hasSprints) {
        const changed = new Date(row.updatedAt);

        return [
            `${changed.getFullYear()}-${String(changed.getMonth() + 1).padStart(2, '0')}`,
            new Intl.DateTimeFormat(locale, {
                month: 'long',
                year: 'numeric',
            }).format(changed),
        ];
    }

    if (row.sprint === null) {
        return ['outside', t('Outside a sprint')];
    }

    return [
        String(row.sprint.number),
        `${sprintTitle(row.sprint, t)} · ${sprintRange(row.sprint, locale)}`,
    ];
}

/**
 * The rows under one heading per sprint, or per month for a team without
 * sprints. A group stands where its first row does and keeps the order of
 * its rows.
 */
export function groupSessions(
    rows: TeamSession[],
    hasSprints: boolean,
    locale: string,
    t: Translate,
): SessionGroup[] {
    const groups = new Map<string, SessionGroup>();

    for (const row of rows) {
        const [key, label] = groupOf(row, hasSprints, locale, t);
        const group = groups.get(key);

        if (group === undefined) {
            groups.set(key, { key, label, rows: [row] });

            continue;
        }

        group.rows.push(row);
    }

    return [...groups.values()];
}

export function sessionsHref(
    workspace: string,
    team: string,
    { kind, q }: { kind?: SessionType | null; q?: string | null } = {},
): string {
    return TeamSessionsController.index.url(
        { workspace, team },
        {
            query: {
                ...(kind === undefined || kind === null ? {} : { kind }),
                ...(q === undefined || q === null ? {} : { q }),
            },
        },
    );
}
