import { useRef, useState } from 'react';
import WhiteboardTimerExtensionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardTimerExtensionsController';
import WhiteboardTimersController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardTimersController';
import { SessionTimer } from '@/components/session/session-timer';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';

type TimerResponse = { timerEndsAt: string | null };

const ExtensionSeconds = 120;

/**
 * The board's countdown. With `controls` (the facilitator) it starts, stops
 * and extends the timer; without, it only shows the time left.
 */
export function BoardTimer({
    state,
    controls = false,
}: {
    state: WhiteboardState;
    controls?: boolean;
}) {
    const request = useWhiteboardRequest();
    const busy = useRef(false);
    const [totalSeconds, setTotalSeconds] = useState<number | undefined>();
    const { board } = state.snapshot;

    const send = async (
        start: () => Promise<TimerResponse>,
        total: (current: number | undefined) => number | undefined,
    ): Promise<void> => {
        if (busy.current) {
            return;
        }

        busy.current = true;

        const response = await request(start());

        busy.current = false;

        if (response === undefined) {
            return;
        }

        setTotalSeconds(total);
        state.setTimer(response.timerEndsAt);
    };

    const setTimer = (seconds: number | null): void => {
        void send(
            () =>
                retroRequest<TimerResponse>(
                    WhiteboardTimersController.update(board.id),
                    { seconds },
                ),
            () => seconds ?? undefined,
        );
    };

    const extend = (): void => {
        void send(
            () =>
                retroRequest<TimerResponse>(
                    WhiteboardTimerExtensionsController.store(board.id),
                ),
            (current) =>
                current === undefined ? undefined : current + ExtensionSeconds,
        );
    };

    return (
        <SessionTimer
            endsAt={board.timerEndsAt}
            offset={state.serverOffset}
            totalSeconds={controls ? totalSeconds : undefined}
            onStart={controls ? setTimer : undefined}
            onStop={controls ? () => setTimer(null) : undefined}
            onExtend={controls ? extend : undefined}
        />
    );
}
