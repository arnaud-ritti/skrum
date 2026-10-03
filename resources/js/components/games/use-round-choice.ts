import { useEffect, useRef, useState } from 'react';
import GameChoicesController from '@/actions/App/Http/Controllers/Games/GameChoicesController';
import type { GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

/** How long the arrow keys rest on a choice before the pick is sent. */
const ArrowPickDelay = 400;

type Options<T extends string | number> = {
    round: GameRound;
    /** The viewer's choice as the round holds it. */
    current: T | null;
    /** After the server took the pick (null: withdrawn). */
    onSent: (choice: T | null) => void;
};

/**
 * A pick among the options of a round (`PUT` / `DELETE rounds/{round}/choice`),
 * shown at once and put back when the server refuses it. A second click on the
 * chosen option withdraws it.
 */
export function useRoundChoice<T extends string | number>({
    round,
    current,
    onSent,
}: Options<T>) {
    const ctx = useRoom();
    const [busy, setBusy] = useState(false);
    const isSending = useRef(false);
    const isArrowing = useRef(false);
    const arrowPick = useRef<{
        timer: ReturnType<typeof setTimeout>;
        previous: T | null;
    } | null>(null);
    const target = { room: ctx.snapshot.room.id, round: round.id };

    useEffect(
        () => () => {
            if (arrowPick.current) {
                clearTimeout(arrowPick.current.timer);
            }
        },
        [],
    );

    const patchChoice = (choice: T | null) => {
        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: { myChoice: choice },
        });
    };

    const send = async (choice: T | null, previous: T | null) => {
        isSending.current = true;
        setBusy(true);

        let result: null | undefined;

        try {
            result = await ctx.run(
                choice === null
                    ? retroRequest<null>(GameChoicesController.destroy(target))
                    : retroRequest<null>(GameChoicesController.update(target), {
                          choice: String(choice),
                      }),
            );
        } finally {
            isSending.current = false;
            setBusy(false);
        }

        if (result === undefined) {
            patchChoice(previous);

            return;
        }

        onSent(choice);
    };

    /**
     * Radix clicks a radio when the arrow keys focus it: those picks wait for
     * the keys to rest, so arrowing through the options sends one request.
     */
    const pickByArrow = (choice: T) => {
        const previous = arrowPick.current?.previous ?? current;

        if (arrowPick.current) {
            clearTimeout(arrowPick.current.timer);
        }

        patchChoice(choice);
        arrowPick.current = {
            previous,
            timer: setTimeout(() => {
                arrowPick.current = null;
                void send(choice, previous);
            }, ArrowPickDelay),
        };
    };

    const choose = (option: T) => {
        if (isSending.current) {
            return;
        }

        if (isArrowing.current) {
            isArrowing.current = false;
            pickByArrow(option);

            return;
        }

        if (arrowPick.current) {
            clearTimeout(arrowPick.current.timer);
            arrowPick.current = null;
        }

        const choice = current === option ? null : option;

        patchChoice(choice);
        void send(choice, current);
    };

    /** Spread on the radio group, to tell the arrow keys from clicks. */
    const groupProps = {
        onKeyDownCapture: (event: React.KeyboardEvent) => {
            isArrowing.current = event.key.startsWith('Arrow');
        },
        onPointerDownCapture: () => {
            isArrowing.current = false;
        },
    };

    return { busy, choose, groupProps };
}
