import { describe, expect, it } from 'vitest';
import type { TeamActivityKind } from '@/types';
import { activityVerb } from './activity';

const kinds: TeamActivityKind[] = [
    'retro_started',
    'retro_completed',
    'poker_started',
    'poker_ended',
    'whiteboard_created',
    'survey_published',
    'survey_closed',
    'action_item_completed',
    'member_joined',
];

describe('activityVerb', () => {
    it('maps the nine kinds to nine distinct keys', () => {
        const verbs = kinds.map((kind) => activityVerb(kind, (key) => key));

        expect(new Set(verbs).size).toBe(9);
        expect(activityVerb('retro_started', (key) => key)).toBe(
            'started the retrospective',
        );
        expect(activityVerb('member_joined', (key) => key)).toBe(
            'joined the team',
        );
    });
});
