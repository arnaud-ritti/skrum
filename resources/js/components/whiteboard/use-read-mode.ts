import { useState } from 'react';

/**
 * Read mode is on by default below `md`, off above. It is local state: not stored, not sent.
 * The default is taken when the board opens: a board opened on a wide screen
 * stays in edit mode when its window narrows.
 */
export function useReadMode(isPhone: boolean): {
    reading: boolean;
    setReading: (reading: boolean) => void;
} {
    const [wantsReading, setWantsReading] = useState(isPhone);

    return { reading: isPhone && wantsReading, setReading: setWantsReading };
}

type LockedView = {
    board: { locked: boolean };
    me: { isFacilitator: boolean };
    viewerIsObserver: boolean;
};

/** An observer of the team only reads the board (P23-04), unless they facilitate it. */
export function isObserving({ me, viewerIsObserver }: LockedView): boolean {
    return viewerIsObserver && !me.isFacilitator;
}

/** A locked board, or an observer's: the canvas is read only for this viewer. */
export function isLockedForViewer(view: LockedView): boolean {
    return (view.board.locked && !view.me.isFacilitator) || isObserving(view);
}
