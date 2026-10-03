import { describe, expect, it, vi } from 'vitest';
import { addSticky } from '@/components/whiteboard/sticky-tool';
import { POSTIT } from '@/lib/whiteboard/palette';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
    restoreElements: (elements: unknown[]) => elements,
}));

function canvas() {
    const existing = [{ id: 'existing' }];

    return {
        getSceneElementsIncludingDeleted: vi.fn(() => existing),
        getAppState: vi.fn(() => ({
            scrollX: 0,
            scrollY: 0,
            zoom: { value: 1 },
            width: 1000,
            height: 600,
        })),
        updateScene: vi.fn(),
    };
}

describe('addSticky', () => {
    it('adds a selected note with the fill and the border of the colour, in the middle of the view', () => {
        const api = canvas();

        const id = addSticky(api as never, 'sky');

        const update = api.updateScene.mock.calls[0][0];
        const note = update.elements[1];

        expect(update.elements[0]).toEqual({ id: 'existing' });
        expect(note).toMatchObject({
            id,
            type: 'rectangle',
            x: 400,
            y: 200,
            width: 200,
            height: 200,
            backgroundColor: POSTIT.sky.bg,
            strokeColor: POSTIT.sky.stroke,
            fillStyle: 'solid',
            customData: { skrum: { kind: 'sticky' } },
        });
        expect(update.appState.selectedElementIds).toEqual({ [id]: true });
        expect(update.captureUpdate).toBe('IMMEDIATELY');
    });

    it('puts the top-left corner of the note on the given point', () => {
        const api = canvas();

        addSticky(api as never, 'moss', { x: 120, y: 80 });

        expect(api.updateScene.mock.calls[0][0].elements[1]).toMatchObject({
            x: 120,
            y: 80,
            backgroundColor: POSTIT.moss.bg,
            strokeColor: POSTIT.moss.stroke,
        });
    });
});
