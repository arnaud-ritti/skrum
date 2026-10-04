import type { TimerState } from '@/lib/retro/types';
import type { BoardContextValue } from './board-context';

export type HighlightAnswer = {
    highlightedCardId: string | null;
    /** The retro's timer, restarted when the shared topic moved on (RT-5). */
    timer?: TimerState;
    /** The topic left, marked discussed on the way (RT-7). */
    discussed?: { cardId: string; discussedAt: string } | null;
};

/**
 * Applies the answer of a move of the shared topic, from the topics list or
 * the Discuss button of a card. The events of a move are sent to the others
 * only: the restarted topic timer and the topic left come back in the answer.
 */
export function applyHighlightAnswer(
    apply: BoardContextValue['apply'],
    answer: HighlightAnswer,
): void {
    apply({ type: 'highlight.set', cardId: answer.highlightedCardId });

    if (answer.timer) {
        apply({ type: 'timer.set', ...answer.timer });
    }

    if (answer.discussed) {
        apply({ type: 'topic.discussed', ...answer.discussed });
    }
}
