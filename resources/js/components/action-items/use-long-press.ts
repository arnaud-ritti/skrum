import { useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

type LongPressOptions = {
    delayMs?: number;
    moveTolerancePx?: number;
};

export type LongPressHandlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onContextMenu: (event: MouseEvent<HTMLElement>) => void;
    onClickCapture: (event: MouseEvent<HTMLElement>) => void;
};

/**
 * A finger or a pen held still on an element (spec 24 §9.5, "appui long"):
 * a mouse keeps its own click. The tap that ends a long press and the
 * context menu it opens on a phone are swallowed; a short tap goes through.
 */
export function useLongPress(
    onLongPress: () => void,
    { delayMs = 500, moveTolerancePx = 10 }: LongPressOptions = {},
): LongPressHandlers {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const origin = useRef<{ x: number; y: number } | null>(null);
    const fired = useRef(false);
    const latest = useRef(onLongPress);

    useEffect(() => {
        latest.current = onLongPress;
    }, [onLongPress]);

    useEffect(
        () => () => {
            if (timer.current !== null) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    const cancel = (): void => {
        if (timer.current !== null) {
            clearTimeout(timer.current);
        }

        timer.current = null;
        origin.current = null;
    };

    return {
        onPointerDown: (event) => {
            cancel();
            fired.current = false;

            if (event.pointerType === 'mouse') {
                return;
            }

            origin.current = { x: event.clientX, y: event.clientY };
            timer.current = setTimeout(() => {
                timer.current = null;
                origin.current = null;
                fired.current = true;
                latest.current();
            }, delayMs);
        },
        onPointerMove: (event) => {
            const from = origin.current;

            if (from === null) {
                return;
            }

            if (
                Math.hypot(event.clientX - from.x, event.clientY - from.y) >
                moveTolerancePx
            ) {
                cancel();
            }
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
        onContextMenu: (event) => {
            if (fired.current || timer.current !== null) {
                event.preventDefault();
            }
        },
        onClickCapture: (event) => {
            if (!fired.current) {
                return;
            }

            fired.current = false;
            event.preventDefault();
            event.stopPropagation();
        },
    };
}
