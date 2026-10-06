import type { CanvasView, Point, Rect } from './viewport';

export type SelectableElement = {
    id: string;
    type: string;
    isDeleted?: boolean;
    locked?: boolean;
    groupIds: readonly string[];
    containerId?: string | null;
    backgroundColor: string;
};

export type SelectionState = {
    selectedElementIds: Readonly<Record<string, boolean>>;
    editingTextElement?: unknown;
    selectedElementsAreBeingDragged?: boolean;
    isResizing?: boolean;
    isRotating?: boolean;
    newElement?: unknown;
    openDialog?: unknown;
};

export type SelectionSummary = {
    ids: string[];
    count: number;
    /** Groups count once: what align and distribute move. */
    units: number;
    hasFill: boolean;
    canGroup: boolean;
    canUngroup: boolean;
    hasLocked: boolean;
    allLocked: boolean;
};

export type Placement = { left: number; top: number; side: 'below' | 'above' };

/** Pixels on screen: 0.75rem, the count chip's 1.625rem, 1rem. */
export const BarGap = 12;
export const ChipHeight = 26;
export const ChipMinWidth = 32;
export const EdgeMargin = 16;

/**
 * Pixels on screen kept free at the bottom of the canvas for the bars docked
 * there: the phone's dock (bottom 1.5rem, 3.5rem high) and, on a wider
 * screen, the history and zoom bars (bottom 1rem, 2.875rem high), with a
 * gap of 0.25rem.
 */
export const PhoneDockBand = 80;
export const DesktopBarsBand = 64;

/**
 * Pixels on screen kept free at the top of the canvas for the facilitator's
 * pill (top 0.75rem, 2.875rem high), with a gap of 0.625rem under it.
 */
export const FacilitationBand = 52;

const Filled: readonly string[] = ['rectangle', 'diamond', 'ellipse'];

export function selectionSummary(
    elements: readonly SelectableElement[],
    state: SelectionState,
): SelectionSummary | null {
    const counted = elements.filter(
        (element) =>
            state.selectedElementIds[element.id] === true &&
            element.isDeleted !== true &&
            !(element.type === 'text' && element.containerId),
    );

    if (counted.length === 0) {
        return null;
    }

    const units = new Set(
        counted.map(
            (element) => element.groupIds.at(-1) ?? `element:${element.id}`,
        ),
    ).size;

    return {
        ids: counted.map((element) => element.id),
        count: counted.length,
        units,
        hasFill: counted.some((element) => Filled.includes(element.type)),
        canGroup: units >= 2,
        canUngroup: counted.some((element) => element.groupIds.length > 0),
        hasLocked: counted.some((element) => element.locked === true),
        allLocked: counted.every((element) => element.locked === true),
    };
}

export function selectionBarShown(state: SelectionState): boolean {
    return !(
        state.editingTextElement ||
        state.selectedElementsAreBeingDragged ||
        state.isResizing ||
        state.isRotating ||
        state.newElement ||
        state.openDialog
    );
}

function toScreen(point: Point, view: CanvasView): Point {
    return {
        x: (point.x + view.scrollX) * view.zoom,
        y: (point.y + view.scrollY) * view.zoom,
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * `leftInset`: the right edge of the open Styles panel, in pixels from the
 * left of the canvas; the bar keeps a gap to it (0 while it is closed).
 */
export function selectionBarPlacement(
    bounds: Rect,
    view: CanvasView,
    bar: { width: number; height: number },
    bottomInset = 0,
    leftInset = 0,
    topInset = 0,
): Placement {
    const topLeft = toScreen({ x: bounds.x, y: bounds.y }, view);
    const bottomRight = toScreen(
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        view,
    );
    const centre = (topLeft.x + bottomRight.x) / 2;
    const left = clamp(
        centre - bar.width / 2,
        leftInset > 0 ? leftInset + BarGap : EdgeMargin,
        view.width - EdgeMargin - bar.width,
    );
    const highestTop = EdgeMargin + topInset;
    const lowestTop = view.height - EdgeMargin - bottomInset - bar.height;
    const below = bottomRight.y + BarGap;

    if (below <= lowestTop) {
        return {
            left,
            top: clamp(below, highestTop, lowestTop),
            side: 'below',
        };
    }

    return {
        left,
        top: clamp(
            topLeft.y - ChipHeight - BarGap - bar.height,
            highestTop,
            lowestTop,
        ),
        side: 'above',
    };
}

/**
 * The count sits on the top-left corner of the selection, slid in from the left edge of the canvas and cut
 * (ellipsis) at its right edge, so it never widens the page; none when too little of the canvas is left for it.
 */
export function selectionCountPlacement(
    bounds: Rect,
    view: CanvasView,
): (Point & { maxWidth: number }) | null {
    const topLeft = toScreen({ x: bounds.x, y: bounds.y }, view);
    const x = Math.max(topLeft.x, 0);
    const maxWidth = view.width - x;

    if (maxWidth < ChipMinWidth) {
        return null;
    }

    return { x, y: topLeft.y - ChipHeight, maxWidth };
}
