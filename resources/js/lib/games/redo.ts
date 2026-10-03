import type { DrawingOp } from './types';

/**
 * The drawer's redo list (spec §6.15): what Undo took, newest last. The
 * server knows nothing of it; a redo sends the op again as a new one.
 */
export type RedoStack = DrawingOp[];

export function pushUndone(
    stack: RedoStack,
    undone: DrawingOp | undefined,
): RedoStack {
    return undone === undefined ? stack : [...stack, undone];
}

export function popRedo(stack: RedoStack): {
    op: DrawingOp | null;
    rest: RedoStack;
} {
    if (stack.length === 0) {
        return { op: null, rest: stack };
    }

    return { op: stack[stack.length - 1], rest: stack.slice(0, -1) };
}

/** "Found by · 2 / 5": a player who joined after the start can still find. */
export function foundByTotal(
    finders: number,
    guessersTotal: number | null | undefined,
): number {
    return Math.max(finders, guessersTotal ?? 0);
}

/** "0:18". */
export function findTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;

    return `${minutes}:${String(rest).padStart(2, '0')}`;
}
