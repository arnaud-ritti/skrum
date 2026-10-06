import { describe, expect, it } from 'vitest';
import { droppedDrawing } from './dropped-drawing';
import type { SceneElement } from './types';

function arrow(
    id: string,
    overrides: Partial<SceneElement> = {},
): SceneElement {
    return {
        id,
        type: 'arrow',
        version: 6,
        versionNonce: 11,
        isDeleted: false,
        points: [[0, 0]],
        ...overrides,
    };
}

describe('droppedDrawing', () => {
    it('gives back, deleted, the connector the library took out of its scene as it ended', () => {
        const drawn = arrow('a');
        const dropped = droppedDrawing(drawn, null, [arrow('other')]);

        expect(dropped).toMatchObject({
            id: 'a',
            isDeleted: true,
            version: 7,
            points: [[0, 0]],
        });
        expect(dropped?.versionNonce).not.toBe(11);
        expect(drawn.isDeleted).toBe(false);
    });

    it('gives nothing while the element is still drawn, once it is kept, or when nothing was drawn', () => {
        const drawn = arrow('a');

        expect(droppedDrawing(drawn, drawn, [])).toBeNull();
        expect(droppedDrawing(drawn, null, [drawn])).toBeNull();
        expect(droppedDrawing(drawn, arrow('next'), [drawn])).toBeNull();
        expect(droppedDrawing(null, null, [])).toBeNull();
    });
});
