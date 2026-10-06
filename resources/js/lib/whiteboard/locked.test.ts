import { describe, expect, it, vi } from 'vitest';
import { lockedElements, lockedUnitAt, unlockElements } from './locked';
import type { LockableElement } from './locked';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
    getCommonBounds: (elements: LockableElement[]) => [
        Math.min(...elements.map((element) => element.x)),
        Math.min(...elements.map((element) => element.y)),
        Math.max(...elements.map((element) => element.x + element.width)),
        Math.max(...elements.map((element) => element.y + element.height)),
    ],
}));

function shape(
    id: string,
    overrides: Partial<LockableElement> = {},
): LockableElement {
    return {
        id,
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        isDeleted: false,
        locked: true,
        groupIds: [],
        containerId: null,
        frameId: null,
        version: 1,
        versionNonce: 1,
        ...overrides,
    };
}

describe('lockedUnitAt', () => {
    it('finds the topmost locked element under a point, and none outside every box', () => {
        const elements = [
            shape('under'),
            shape('over', { x: 50, y: 50 }),
            shape('free', { x: 60, y: 60, locked: false }),
            shape('gone', { x: 60, y: 60, isDeleted: true }),
        ];

        expect(lockedUnitAt(elements, { x: 70, y: 70 })).toEqual(['over']);
        expect(lockedUnitAt(elements, { x: 10, y: 10 })).toEqual(['under']);
        expect(lockedUnitAt(elements, { x: 151, y: 70 })).toBeNull();
        expect(lockedUnitAt([], { x: 10, y: 10 })).toBeNull();
    });

    it('takes a locked group whole, and the shape for the text bound to it', () => {
        const elements = [
            shape('left', { groupIds: ['inner', 'outer'] }),
            shape('right', { x: 200, groupIds: ['outer'] }),
            shape('label', { x: 210, y: 10, width: 20, containerId: 'right' }),
            shape('apart', { x: 400, groupIds: ['other'] }),
        ];

        expect(lockedUnitAt(elements, { x: 215, y: 15 })).toEqual([
            'left',
            'right',
        ]);
    });
});

describe('lockedElements', () => {
    it('counts the live locked shapes, not the text bound to one', () => {
        expect(
            lockedElements([
                shape('one'),
                shape('label', { containerId: 'one' }),
                shape('free', { locked: false }),
                shape('gone', { isDeleted: true }),
            ]).map((element) => element.id),
        ).toEqual(['one']);
    });
});

describe('unlockElements', () => {
    it('unlocks the elements with their bound text and what a frame holds, as one undoable change, and selects them', () => {
        const elements = [
            shape('note'),
            shape('label', { containerId: 'note' }),
            shape('frame', { type: 'frame' }),
            shape('child', { frameId: 'frame' }),
            shape('other'),
        ];
        const api = {
            getSceneElementsIncludingDeleted: () => elements,
            updateScene: vi.fn(),
        };

        unlockElements(api as never, ['note', 'frame']);

        const update = api.updateScene.mock.calls[0][0];

        expect(
            update.elements.map((element: LockableElement) => [
                element.id,
                element.locked,
                element.version,
            ]),
        ).toEqual([
            ['note', false, 2],
            ['label', false, 2],
            ['frame', false, 2],
            ['child', false, 2],
            ['other', true, 1],
        ]);
        expect(update.elements[4]).toBe(elements[4]);
        expect(update.elements[0].versionNonce).not.toBe(1);
        expect(update.appState).toEqual({
            selectedElementIds: { note: true, frame: true },
        });
        expect(update.captureUpdate).toBe('IMMEDIATELY');
    });

    it('writes nothing when no element is given', () => {
        const api = {
            getSceneElementsIncludingDeleted: () => [shape('note')],
            updateScene: vi.fn(),
        };

        unlockElements(api as never, []);

        expect(api.updateScene).not.toHaveBeenCalled();
    });
});
