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

/** The lock keeps the last word: leaving read mode never opens a locked board. */
export function isViewMode(
    lockedForViewer: boolean,
    reading: boolean,
): boolean {
    return lockedForViewer || reading;
}

/** The toggle is for a phone viewer who may edit. */
export function canSwitchReadMode(
    isPhone: boolean,
    lockedForViewer: boolean,
): boolean {
    return isPhone && !lockedForViewer;
}
