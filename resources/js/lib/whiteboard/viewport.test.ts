import { describe, expect, it } from 'vitest';
import {
    MaxZoom,
    MinZoom,
    canZoom,
    centredOn,
    pannedBy,
    steppedZoom,
    visibleArea,
    zoomAroundCentre,
    zoomPercent,
} from './viewport';

const view = { scrollX: 0, scrollY: 0, zoom: 1, width: 1000, height: 800 };

describe('viewport', () => {
    it('steps by ten percent from wherever the zoom is', () => {
        expect(steppedZoom(1, 1)).toBe(1.1);
        expect(steppedZoom(1, -1)).toBe(0.9);
        expect(steppedZoom(0.85, 1)).toBe(0.9);
        expect(steppedZoom(0.85, -1)).toBe(0.8);
        expect(steppedZoom(0.3, 1)).toBe(0.4);
    });

    it('stops at the ends of the library range', () => {
        expect(steppedZoom(MinZoom, -1)).toBe(MinZoom);
        expect(steppedZoom(MaxZoom, 1)).toBe(MaxZoom);
        expect(canZoom(MinZoom, -1)).toBe(false);
        expect(canZoom(MaxZoom, 1)).toBe(false);
        expect(canZoom(1, 1)).toBe(true);
    });

    it('keeps the centre of the view where it was', () => {
        const patch = zoomAroundCentre(view, 2);

        expect(patch).toEqual({ zoom: 2, scrollX: -250, scrollY: -200 });
        expect(visibleArea({ ...view, ...patch })).toEqual({
            x: 250,
            y: 200,
            width: 500,
            height: 400,
        });
    });

    it('centres the view on a scene point at the same zoom', () => {
        expect(centredOn({ ...view, zoom: 2 }, { x: 100, y: 50 })).toEqual({
            zoom: 2,
            scrollX: 150,
            scrollY: 150,
        });
    });

    it('pans by a share of the visible area', () => {
        expect(pannedBy(view, 0.1, 0)).toEqual({
            zoom: 1,
            scrollX: -100,
            scrollY: 0,
        });
        expect(pannedBy({ ...view, zoom: 2 }, 0, -0.1)).toEqual({
            zoom: 2,
            scrollX: 0,
            scrollY: 40,
        });
    });

    it('shows the zoom as a rounded percentage', () => {
        expect(zoomPercent(0.8)).toBe(80);
        expect(zoomPercent(1.234)).toBe(123);
    });
});
