import { formatSeconds } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';
import { BoardTimer } from './board-topbar';
import { useDiscussion } from './phase-discussing';

/**
 * The timer of the discussion, on the stage between "Previous topic" and
 * "Next topic" (RT-5): the retro's timer in the large size. Started here by
 * the facilitator, its duration becomes the time per topic. "of 5:00 · this
 * topic" says it belongs to the shared topic, and only there.
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
            className="flex min-w-0 justify-center *:data-[slot=timer]:flex-wrap *:data-[slot=timer]:justify-center"
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
