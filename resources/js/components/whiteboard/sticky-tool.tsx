import {
    CaptureUpdateAction,
    restoreElements,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { randomHexId } from '@/lib/random-id';
import { POSTIT, type PostItColor } from '@/lib/whiteboard/palette';
import type { Point } from '@/lib/whiteboard/viewport';

const Size = 200;

function randomInteger(): number {
    return Math.floor(Math.random() * 2 ** 31);
}

/**
 * A sticky note is a rectangle the server recognises by its marker (spec §6.1).
 * Its fill and its border are the literal light values of one of the eight
 * colours (answers 7-D1 and 7-D4).
 */
function stickyAt(x: number, y: number, color: PostItColor) {
    return {
        id: randomHexId(20),
        type: 'rectangle',
        x,
        y,
        width: Size,
        height: Size,
        angle: 0,
        strokeColor: POSTIT[color].stroke,
        backgroundColor: POSTIT[color].bg,
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 },
        seed: randomInteger(),
        version: 1,
        versionNonce: randomInteger(),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        customData: { skrum: { kind: 'sticky' } },
    };
}

/**
 * Adds a sticky of `color` with its top-left corner at `at` (scene), or
 * centred in the view when `at` is omitted, and selects it. Returns its id.
 */
export function addSticky(
    api: ExcalidrawImperativeAPI,
    color: PostItColor,
    at?: Point,
): string {
    const { scrollX, scrollY, zoom, width, height } = api.getAppState();
    const x = at?.x ?? width / 2 / zoom.value - scrollX - Size / 2;
    const y = at?.y ?? height / 2 / zoom.value - scrollY - Size / 2;
    const sticky = stickyAt(x, y, color);
    const [restored] = restoreElements([sticky] as never, null);

    api.updateScene({
        elements: [...api.getSceneElementsIncludingDeleted(), restored],
        appState: { selectedElementIds: { [sticky.id]: true } } as never,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    return sticky.id;
}
