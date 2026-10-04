import { describe, expect, it, vi } from 'vitest';
import { applyHighlightAnswer } from '@/components/retro/highlight-answer';

describe('applyHighlightAnswer', () => {
    it('applies the shared topic, the restarted timer and the topic left marked discussed', () => {
        const apply = vi.fn();

        applyHighlightAnswer(apply, {
            highlightedCardId: 'card-2',
            timer: {
                timerEndsAt: '2026-10-04T10:05:00Z',
                timerPausedSeconds: null,
                topicSeconds: 300,
            },
            discussed: {
                cardId: 'card-1',
                discussedAt: '2026-10-04T10:00:00Z',
            },
        });

        expect(apply.mock.calls).toEqual([
            [{ type: 'highlight.set', cardId: 'card-2' }],
            [
                {
                    type: 'timer.set',
                    timerEndsAt: '2026-10-04T10:05:00Z',
                    timerPausedSeconds: null,
                    topicSeconds: 300,
                },
            ],
            [
                {
                    type: 'topic.discussed',
                    cardId: 'card-1',
                    discussedAt: '2026-10-04T10:00:00Z',
                },
            ],
        ]);
    });

    it('only moves the shared topic when the answer has no timer and no topic left', () => {
        const apply = vi.fn();

        applyHighlightAnswer(apply, {
            highlightedCardId: null,
            discussed: null,
        });

        expect(apply.mock.calls).toEqual([
            [{ type: 'highlight.set', cardId: null }],
        ]);
    });
});
