import RetroTimerPausesController from '@/actions/App/Http/Controllers/Retros/RetroTimerPausesController';
import { retroRequest } from '@/lib/retro/api';
import type { TimerState } from '@/lib/retro/types';
import { useBoard } from './board-context';

/**
 * Pause and resume of the retro's timer (RT-2): one pair of calls for the
 * timer's toggle and the facilitator bar, so both do the same thing.
 */
export function useTimerPause(): {
    pause: () => Promise<TimerState | undefined>;
    resume: () => Promise<TimerState | undefined>;
} {
    const ctx = useBoard();
    const retroId = ctx.board.retro.id;

    const send = async (paused: boolean) => {
        const response = await ctx.run(
            retroRequest<TimerState>(
                paused
                    ? RetroTimerPausesController.update(retroId)
                    : RetroTimerPausesController.destroy(retroId),
            ),
        );

        if (!response) {
            return undefined;
        }

        ctx.apply({ type: 'timer.set', ...response });

        return response;
    };

    return { pause: () => send(true), resume: () => send(false) };
}
