import { describe, expect, it } from 'vitest';
import { POSTIT } from './palette';
import { fromMinimap, minimapFrame, minimapItems, toMinimap } from './minimap';

const base = {
    isDeleted: false,
    containerId: null,
    backgroundColor: 'transparent',
};

describe('minimap', () => {
    it('keeps live elements, drops tombstones and bound texts, and colours the eight fills', () => {
        const items = minimapItems([
            {
                ...base,
                id: 'note',
                type: 'rectangle',
                x: 0,
                y: 0,
                width: 100,
                height: 50,
                backgroundColor: POSTIT.sky.bg,
            },
            {
                ...base,
                id: 'label',
                type: 'text',
                x: 10,
                y: 10,
                width: 40,
                height: 20,
                containerId: 'note',
            },
            {
                ...base,
                id: 'gone',
                type: 'ellipse',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                isDeleted: true,
            },
            {
                ...base,
                id: 'title',
                type: 'text',
                x: 300,
                y: 0,
                width: 80,
                height: 30,
            },
        ]);

        expect(items).toEqual([
            {
                id: 'note',
                rect: { x: 0, y: 0, width: 100, height: 50 },
                color: 'sky',
            },
            {
                id: 'title',
                rect: { x: 300, y: 0, width: 80, height: 30 },
                color: null,
            },
        ]);
    });

    it('measures a line from its points', () => {
        const [line] = minimapItems([
            {
                ...base,
                id: 'arrow',
                type: 'arrow',
                x: 100,
                y: 100,
                width: 50,
                height: 30,
                points: [
                    [0, 0],
                    [-50, 30],
                ],
            },
        ]);

        expect(line.rect).toEqual({ x: 50, y: 100, width: 50, height: 30 });
    });

    it('fits the board and the visible area in the minimap, centred', () => {
        const items = [
            {
                id: 'a',
                rect: { x: 0, y: 0, width: 100, height: 50 },
                color: null,
            },
        ];
        const frame = minimapFrame(
            items,
            { x: 0, y: 0, width: 200, height: 100 },
            { width: 180, height: 112 },
        );

        expect(frame.scale).toBeCloseTo(0.82);
        expect(toMinimap(items[0].rect, frame)).toEqual({
            x: 8,
            y: 15,
            width: 82,
            height: 41,
        });
        expect(fromMinimap({ x: 90, y: 56 }, frame).x).toBeCloseTo(100);
        expect(fromMinimap({ x: 90, y: 56 }, frame).y).toBeCloseTo(50);
    });

    it('draws only the visible area on an empty board', () => {
        const frame = minimapFrame(
            [],
            { x: -500, y: -400, width: 1000, height: 800 },
            { width: 180, height: 112 },
        );

        expect(
            toMinimap({ x: -500, y: -400, width: 1000, height: 800 }, frame)
                .width,
        ).toBeCloseTo(120);
    });
});
