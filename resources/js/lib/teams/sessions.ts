import type { Translate } from '@/hooks/use-trans';
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

function kindParts(row: TeamSession, t: Translate): (string | null)[] {
    switch (row.kind) {
        case 'retro':
            return [
                row.phase,
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
            return [
                row.answers === null
                    ? null
                    : row.answers === 1
                      ? t('1 answer')
                      : t(':count answers', { count: row.answers }),
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
    q?: string | null,
): string {
    return TeamSessionsController.index.url(
        { workspace, team },
        {
            query: {
                tab,
                ...(before === undefined || before === null ? {} : { before }),
                ...(q === undefined || q === null ? {} : { q }),
            },
        },
    );
}
