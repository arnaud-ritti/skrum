/**
 * The library's view: a scene point `p` is drawn at `(p.x + scrollX) × zoom`,
 * the convention `useWhiteboardFollow` already relies on.
 */
export type CanvasView = {
    scrollX: number;
    scrollY: number;
    zoom: number;
    width: number;
    height: number;
};
export type ViewPatch = { scrollX: number; scrollY: number; zoom: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * The library's range (`MIN_ZOOM`, `MAX_ZOOM` of 0.18.1); a wheel zoom reaches it, so the bar does too.
 * Check this when the library is upgraded.
 */
export const MinZoom = 0.1;
export const MaxZoom = 30;
const StepsPerUnit = 10;
const Epsilon = 1e-9;

export function clampZoom(zoom: number): number {
    return Math.min(MaxZoom, Math.max(MinZoom, zoom));
}

export function steppedZoom(zoom: number, direction: 1 | -1): number {
    const steps = zoom * StepsPerUnit;
    const next =
        direction === 1
            ? Math.floor(steps + Epsilon) + 1
            : Math.ceil(steps - Epsilon) - 1;

    return clampZoom(next / StepsPerUnit);
}

export function canZoom(zoom: number, direction: 1 | -1): boolean {
    return direction === 1
        ? zoom < MaxZoom - Epsilon
        : zoom > MinZoom + Epsilon;
}

export function visibleArea(view: CanvasView): Rect {
    return {
        x: -view.scrollX,
        y: -view.scrollY,
        width: view.width / view.zoom,
        height: view.height / view.zoom,
    };
}

export function centredOn(view: CanvasView, point: Point): ViewPatch {
    return {
        zoom: view.zoom,
        scrollX: view.width / 2 / view.zoom - point.x,
        scrollY: view.height / 2 / view.zoom - point.y,
    };
}

export function zoomAroundCentre(view: CanvasView, zoom: number): ViewPatch {
    const area = visibleArea(view);
    const centre = { x: area.x + area.width / 2, y: area.y + area.height / 2 };

    return centredOn({ ...view, zoom: clampZoom(zoom) }, centre);
}

export function pannedBy(
    view: CanvasView,
    fractionX: number,
    fractionY: number,
): ViewPatch {
    const area = visibleArea(view);

    return {
        zoom: view.zoom,
        scrollX: view.scrollX - fractionX * area.width,
        scrollY: view.scrollY - fractionY * area.height,
    };
}

export function zoomPercent(zoom: number): number {
    return Math.round(zoom * 100);
}
