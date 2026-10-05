import type { Translate } from '@/hooks/use-trans';
import type { TeamActivityKind } from '@/types';

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
