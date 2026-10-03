import { describe, expect, it } from 'vitest';
import type { TeamActivityKind } from '@/types';
import { activitySentence } from './activity';

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

describe('activitySentence', () => {
    it('maps the nine kinds to nine whole sentences with their placeholders', () => {
        const sentences = kinds.map((kind) =>
            activitySentence(kind, (key) => key),
        );

        expect(new Set(sentences).size).toBe(9);
        expect(sentences.every((sentence) => sentence.includes(':actor'))).toBe(
            true,
        );
        expect(activitySentence('retro_started', (key) => key)).toBe(
            ':actor started the retrospective :title',
        );
        expect(activitySentence('action_item_completed', (key) => key)).toBe(
            ':actor completed :title',
        );
        expect(activitySentence('member_joined', (key) => key)).toBe(
            ':actor joined the team',
        );
    });
});
