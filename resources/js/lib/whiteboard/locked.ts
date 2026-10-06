import { CaptureUpdateAction, getCommonBounds } from './excalidraw';
import type { ExcalidrawImperativeAPI } from './excalidraw';
import type { Point, Rect } from './viewport';

export type LockableElement = {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted?: boolean;
    locked?: boolean;
    groupIds: readonly string[];
    containerId?: string | null;
    frameId?: string | null;
    version: number;
    versionNonce: number;
};

/** The live locked elements a person points at: a text bound to a shape goes with its shape. */
export function lockedElements<T extends LockableElement>(
    elements: readonly T[],
): T[] {
    return elements.filter(
        (element) =>
            element.locked === true &&
            element.isDeleted !== true &&
            !element.containerId,
    );
}

export function elementBounds(element: LockableElement): Rect {
    const [minX, minY, maxX, maxY] = getCommonBounds([element] as never);

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function holds(bounds: Rect, point: Point): boolean {
    return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
    );
}

/**
 * The locked element under a scene point, the topmost first, with the rest of
 * its group when it has one: what a click on it means. The library selects no
 * locked element on a click, so the board finds it.
 */
export function lockedUnitAt(
    elements: readonly LockableElement[],
    point: Point,
): string[] | null {
    const locked = lockedElements(elements);
    // ponytail: the bounding box, also for a rotated or a hollow shape and for a
    // frame's inside; the library's own hit test is not exported. Use it if it is one day.
    const hit = locked.findLast((element) =>
        holds(elementBounds(element), point),
    );

    if (hit === undefined) {
        return null;
    }

    const group = hit.groupIds.at(-1);

    if (group === undefined) {
        return [hit.id];
    }

    return locked
        .filter((element) => element.groupIds.at(-1) === group)
        .map((element) => element.id);
}

/**
 * Unlocks the elements, the text bound to them and what a frame among them
 * holds (what the library's own lock takes along), as one change the canvas
 * reports, syncs and can undo, then selects them.
 */
export function unlockElements(
    api: ExcalidrawImperativeAPI,
    ids: readonly string[],
): void {
    if (ids.length === 0) {
        return;
    }

    const unlocked = new Set(ids);
    const elements =
        api.getSceneElementsIncludingDeleted() as unknown as LockableElement[];

    api.updateScene({
        elements: elements.map((element) => {
            const isTaken =
                unlocked.has(element.id) ||
                unlocked.has(element.containerId ?? '') ||
                unlocked.has(element.frameId ?? '');

            if (!isTaken || element.locked !== true) {
                return element;
            }

            return {
                ...element,
                locked: false,
                version: element.version + 1,
                versionNonce: Math.floor(Math.random() * 2 ** 31),
            };
        }) as never,
        appState: {
            selectedElementIds: Object.fromEntries(
                ids.map((id) => [id, true as const]),
            ),
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
}
