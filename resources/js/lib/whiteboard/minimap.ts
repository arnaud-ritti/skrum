import { postItFromBackground, type PostItColor } from './palette';
import type { Point, Rect } from './viewport';

export type MinimapElement = {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted?: boolean;
    containerId?: string | null;
    backgroundColor?: string;
    points?: readonly (readonly [number, number])[];
};
export type MinimapItem = { id: string; rect: Rect; color: PostItColor | null };
export type MinimapFrame = { origin: Point; scale: number; offset: Point };
type Size = { width: number; height: number };

const MinSide = 1;

/** A loop, not spread arguments: a long stroke has more points than a call takes. */
function union(rects: readonly Rect[]): Rect {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const rect of rects) {
        left = Math.min(left, rect.x);
        top = Math.min(top, rect.y);
        right = Math.max(right, rect.x + rect.width);
        bottom = Math.max(bottom, rect.y + rect.height);
    }

    return { x: left, y: top, width: right - left, height: bottom - top };
}

function rectOf(element: MinimapElement): Rect {
    if (element.points && element.points.length > 0) {
        const bounds = union(
            element.points.map(([x, y]) => ({
                x: element.x + x,
                y: element.y + y,
                width: 0,
                height: 0,
            })),
        );

        return {
            ...bounds,
            width: Math.max(bounds.width, MinSide),
            height: Math.max(bounds.height, MinSide),
        };
    }

    return {
        x: Math.min(element.x, element.x + element.width),
        y: Math.min(element.y, element.y + element.height),
        width: Math.max(Math.abs(element.width), MinSide),
        height: Math.max(Math.abs(element.height), MinSide),
    };
}

export function minimapItems(
    elements: readonly MinimapElement[],
): MinimapItem[] {
    return elements
        .filter(
            (element) =>
                element.isDeleted !== true &&
                !(element.type === 'text' && element.containerId),
        )
        .map((element) => ({
            id: element.id,
            rect: rectOf(element),
            color: element.backgroundColor
                ? postItFromBackground(element.backgroundColor)
                : null,
        }));
}

export function minimapFrame(
    items: readonly MinimapItem[],
    visible: Rect,
    size: Size,
    padding = 8,
): MinimapFrame {
    const world = union([visible, ...items.map((item) => item.rect)]);
    const inner = {
        width: Math.max(size.width - padding * 2, MinSide),
        height: Math.max(size.height - padding * 2, MinSide),
    };
    const scale = Math.min(
        inner.width / world.width,
        inner.height / world.height,
    );

    return {
        origin: { x: world.x, y: world.y },
        scale,
        offset: {
            x: padding + (inner.width - world.width * scale) / 2,
            y: padding + (inner.height - world.height * scale) / 2,
        },
    };
}

export function toMinimap(rect: Rect, frame: MinimapFrame): Rect {
    return {
        x: (rect.x - frame.origin.x) * frame.scale + frame.offset.x,
        y: (rect.y - frame.origin.y) * frame.scale + frame.offset.y,
        width: rect.width * frame.scale,
        height: rect.height * frame.scale,
    };
}

export function fromMinimap(point: Point, frame: MinimapFrame): Point {
    return {
        x: (point.x - frame.offset.x) / frame.scale + frame.origin.x,
        y: (point.y - frame.offset.y) / frame.scale + frame.origin.y,
    };
}
