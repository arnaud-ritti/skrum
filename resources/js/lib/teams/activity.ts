import type { TeamActivityKind } from '@/types';

type Translate = (key: string) => string;

/** The words between the actor and the subject of a line of the feed. */
export function activityVerb(kind: TeamActivityKind, t: Translate): string {
    switch (kind) {
        case 'retro_started':
            return t('started the retrospective');
        case 'retro_completed':
            return t('closed the retrospective');
        case 'poker_started':
            return t('started the planning poker');
        case 'poker_ended':
            return t('ended the planning poker');
        case 'whiteboard_created':
            return t('created the whiteboard');
        case 'survey_published':
            return t('published the survey');
        case 'survey_closed':
            return t('closed the survey');
        case 'action_item_completed':
            return t('completed');
        case 'member_joined':
            return t('joined the team');
    }
}
