import TeamActivitiesController from '@/actions/App/Http/Controllers/TeamActivitiesController';
import type { Translate } from '@/hooks/use-trans';
import type { TeamActivityKind } from '@/types';

/** The chips of the Activity page, in their order; "All" is no group. */
export const ActivityGroups = ['sessions', 'actions', 'members'] as const;

export type ActivityGroup = (typeof ActivityGroups)[number];

/** The filters of the Activity page, each null when it is not set. */
export type ActivityFilters = {
    group: ActivityGroup | null;
    /** The id of a member of the team. */
    actor: string | null;
    /** A `Y-m-d` day of the application's time zone. */
    day: string | null;
};

/** The filters that are set, as the query of the page and of its "Load more". */
export function activityQuery(
    filters: ActivityFilters,
): Record<string, string> {
    return Object.fromEntries(
        Object.entries(filters).filter(
            (entry): entry is [string, string] => entry[1] !== null,
        ),
    );
}

export function activityHref(
    workspace: string,
    team: string,
    filters?: ActivityFilters,
): string {
    return TeamActivitiesController.index.url(
        { workspace, team },
        filters === undefined ? undefined : { query: activityQuery(filters) },
    );
}

/** The whole sentence of a line of the feed, its `:actor` and `:title` placeholders left for the card to fill. */
export function activitySentence(kind: TeamActivityKind, t: Translate): string {
    switch (kind) {
        case 'retro_started':
            return t(':actor started the retrospective :title');
        case 'retro_completed':
            return t(':actor closed the retrospective :title');
        case 'poker_started':
            return t(':actor started the planning poker :title');
        case 'poker_ended':
            return t(':actor ended the planning poker :title');
        case 'whiteboard_created':
            return t(':actor created the whiteboard :title');
        case 'survey_published':
            return t(':actor published the survey :title');
        case 'survey_closed':
            return t(':actor closed the survey :title');
        case 'action_item_completed':
            return t(':actor completed :title');
        case 'member_joined':
            return t(':actor joined the team');
    }
}
