import { describe, expect, it } from 'vitest';
import { estimateMinutesLabel, topicEstimateSeconds } from './topic-estimate';
import type { Topic } from './topics';

const topic = (id: string): Topic => ({
    id,
    leadCardId: id,
    title: id,
    votes: 0,
    columnId: 'c',
    cardIds: [id],
});
const topics = ['a', 'b', 'c', 'd', 'e', 'f'].map(topic);

describe('topicEstimateSeconds', () => {
    it('is nothing without a time per topic', () => {
        expect(
            topicEstimateSeconds({
                topics,
                sharedId: 'b',
                discussedIds: new Set(['a']),
                topicSeconds: null,
                sharedRemaining: 100,
            }),
        ).toBeNull();
    });

    it('adds what is left of the shared topic to a full time per topic for the others not discussed', () => {
        expect(
            topicEstimateSeconds({
                topics,
                sharedId: 'b',
                discussedIds: new Set(['a']),
                topicSeconds: 300,
                sharedRemaining: 252,
            }),
        ).toBe(252 + 4 * 300);
    });

    it('counts a full time for the shared topic when its timer is not running', () => {
        expect(
            topicEstimateSeconds({
                topics,
                sharedId: 'b',
                discussedIds: new Set(),
                topicSeconds: 300,
                sharedRemaining: null,
            }),
        ).toBe(6 * 300);
    });

    it('counts nothing for a shared topic already discussed', () => {
        expect(
            topicEstimateSeconds({
                topics,
                sharedId: 'a',
                discussedIds: new Set(['a', 'b', 'c', 'd', 'e']),
                topicSeconds: 300,
                sharedRemaining: 120,
            }),
        ).toBe(300);
    });
});

describe('estimateMinutesLabel', () => {
    const t = (key: string, replace: Record<string, string | number> = {}) =>
        Object.entries(replace).reduce(
            (text, [name, value]) => text.replace(`:${name}`, String(value)),
            key,
        );

    it('rounds the minutes up', () => {
        expect(estimateMinutesLabel(1_201, t)).toBe('~ 21 min left');
        expect(estimateMinutesLabel(60, t)).toBe('~ 1 min left');
    });

    it('says less than a minute under a minute', () => {
        expect(estimateMinutesLabel(59, t)).toBe('< 1 min left');
        expect(estimateMinutesLabel(0, t)).toBe('< 1 min left');
    });
});
