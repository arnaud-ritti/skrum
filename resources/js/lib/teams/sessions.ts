import TeamSessionsController from '@/actions/App/Http/Controllers/TeamSessionsController';
import type { SessionType } from '@/components/skrum/session-type-picker';

export const SessionTabs = ['upcoming', 'live', 'finished'] as const;

export type SessionTab = (typeof SessionTabs)[number];

/** A row of `ListTeamSessions`: the fields a kind does not have are null. */
export type TeamSession = {
    kind: SessionType;
    id: string;
    title: string;
    url: string;
    state: SessionTab;
    updatedAt: string;
    isDraft: boolean;
    phase: string | null;
    people: number | null;
    tasks: number | null;
    facilitator: string | null;
    answers: number | null;
    game: string | null;
};

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

function kindLabel(kind: SessionType, t: Translate): string {
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

function counted(
    count: number,
    one: string,
    many: string,
    t: Translate,
): string {
    return count === 1 ? t(one) : t(many, { count });
}

function kindParts(row: TeamSession, t: Translate): (string | null)[] {
    switch (row.kind) {
        case 'retro':
            return [
                row.phase,
                row.people === null
                    ? null
                    : counted(row.people, '1 person', ':count people', t),
            ];
        case 'poker':
            return [
                row.tasks === null
                    ? null
                    : counted(row.tasks, '1 task', ':count tasks', t),
            ];
        case 'whiteboard':
            return [
                row.facilitator === null
                    ? null
                    : t('Facilitated by :name', { name: row.facilitator }),
            ];
        case 'survey':
            return [
                row.answers === null
                    ? null
                    : counted(row.answers, '1 answer', ':count answers', t),
            ];
        case 'icebreaker':
            return [row.game];
    }
}

/** The meta line of a row: the kind, then what the kind tells of the session. */
export function sessionMeta(row: TeamSession, t: Translate): string {
    return [kindLabel(row.kind, t), ...kindParts(row, t)]
        .filter((part): part is string => part !== null && part !== '')
        .join(' · ');
}

export function sessionsHref(
    workspace: string,
    team: string,
    tab: SessionTab,
    before?: string | null,
): string {
    return TeamSessionsController.index.url(
        { workspace, team },
        {
            query: {
                tab,
                ...(before === undefined || before === null ? {} : { before }),
            },
        },
    );
}
