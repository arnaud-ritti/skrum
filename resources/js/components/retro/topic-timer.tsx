import { formatSeconds } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { BoardTimer } from './board-topbar';
import { useDiscussion } from './phase-discussing';

/**
 * The timer of the discussion, on the stage between "Previous topic" and
 * "Next topic" (RT-5): the retro's timer in the large size. Started here by
 * the facilitator, its duration becomes the time per topic. "of 5:00 · this
 * topic" says it belongs to the shared topic, and only there. Beside the
 * notes at 1440 its gaps and buttons tighten, so it stays on the line of the
 * two buttons as in the mockup; the caption never breaks, the controls go
 * under it when the room runs out. On a narrower stage it takes its own row
 * above the buttons.
 */
export function TopicTimer() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { current, shared } = useDiscussion();
    const { topicSeconds } = board.retro;
    const isSharedInFront = current !== null && current.id === shared?.id;
    const timesTopic = isSharedInFront && topicSeconds !== null;

    return (
        <div
            data-slot="retro-topic-timer"
            className={cn(
                'order-first flex min-w-0 basis-full justify-center *:data-[slot=timer]:flex-wrap *:data-[slot=timer]:justify-center',
                '@xl/topic-nav:order-none @xl/topic-nav:flex-1 @xl/topic-nav:basis-0',
                '@xl/topic-nav:*:data-[slot=timer]:gap-1',
                '@xl/topic-nav:**:data-[slot=button]:px-2 @xl/topic-nav:**:data-[slot=timer-pill]:gap-1.5 @xl/topic-nav:**:data-[slot=timer-pill]:px-2.5',
                '@xl/topic-nav:**:data-[slot=button]:shrink-0 @xl/topic-nav:**:data-[slot=dropdown-menu-trigger]:size-8 @xl/topic-nav:**:data-[slot=dropdown-menu-trigger]:shrink-0 @xl/topic-nav:**:data-[slot=timer-toggle]:size-8 @xl/topic-nav:**:data-[slot=timer-toggle]:shrink-0',
                '@3xl/topic-nav:**:data-[slot=button]:px-3 @3xl/topic-nav:**:data-[slot=dropdown-menu-trigger]:size-9 @3xl/topic-nav:*:data-[slot=timer]:gap-2 @3xl/topic-nav:**:data-[slot=timer-pill]:gap-2 @3xl/topic-nav:**:data-[slot=timer-pill]:px-4 @3xl/topic-nav:**:data-[slot=timer-toggle]:size-9',
            )}
        >
            <BoardTimer
                size="lg"
                totalSeconds={timesTopic ? topicSeconds : undefined}
                caption={
                    timesTopic
                        ? t('of :total · this topic', {
                              total: formatSeconds(topicSeconds),
                          })
                        : undefined
                }
            />
        </div>
    );
}
