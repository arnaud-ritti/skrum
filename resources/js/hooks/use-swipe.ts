import { useRef } from 'react';
import type { PointerEvent } from 'react';

/** Share of the width a horizontal move must cross to count as a swipe. */
const SwipeThreshold = 0.25;

type SwipeHandlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
};

function startsInTextField(target: EventTarget): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    );
}

/**
 * A horizontal swipe on an area: 1 for a move to the left (the next one), -1
 * for a move to the right. The area keeps its vertical scroll with
 * `touch-pan-y`. `cancel` voids the move in progress, for a host whose own
 * drag took it over.
 */
export function useSwipe(onSwipe: (direction: -1 | 1) => void): {
    handlers: SwipeHandlers;
    cancel: () => void;
} {
    const start = useRef<{ x: number; y: number } | null>(null);

    return {
        cancel: () => {
            start.current = null;
        },
        handlers: {
            onPointerDown: (event) => {
                start.current = null;

                // A dialog opened from the area is a React child of it, not a
                // DOM one: its moves are its own.
                if (
                    !(event.target instanceof Node) ||
                    !event.currentTarget.contains(event.target) ||
                    startsInTextField(event.target)
                ) {
                    return;
                }

                start.current = { x: event.clientX, y: event.clientY };
            },
            onPointerUp: (event) => {
                const from = start.current;

                start.current = null;

                if (from === null) {
                    return;
                }

                const dx = event.clientX - from.x;
                const dy = event.clientY - from.y;
                const { width } = event.currentTarget.getBoundingClientRect();

                if (
                    width === 0 ||
                    Math.abs(dx) < width * SwipeThreshold ||
                    Math.abs(dx) <= Math.abs(dy)
                ) {
                    return;
                }

                onSwipe(dx < 0 ? 1 : -1);
            },
            onPointerCancel: () => {
                start.current = null;
            },
        },
    };
}
