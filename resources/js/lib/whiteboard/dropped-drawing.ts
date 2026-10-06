import type { SceneElement } from './types';

/**
 * The library takes the element it was drawing out of its scene when there is
 * nothing of it to keep (a connector of a single point, a shape too small to
 * see) without marking it deleted, so the scene sync, which had it queued or
 * sent, would leave it alive on the server. Given the element drawn at the
 * last change, the one drawn now and the scene, returns the dropped element as
 * a deleted one to put back, or null. Check this when the library is upgraded.
 */
export function droppedDrawing(
    left: SceneElement | null,
    drawn: SceneElement | null,
    elements: readonly SceneElement[],
): SceneElement | null {
    if (left === null || left.id === drawn?.id) {
        return null;
    }

    if (elements.some((element) => element.id === left.id)) {
        return null;
    }

    return {
        ...left,
        isDeleted: true,
        version: left.version + 1,
        versionNonce: Math.floor(Math.random() * 2 ** 31),
    };
}
