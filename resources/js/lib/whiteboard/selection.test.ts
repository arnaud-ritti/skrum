import { describe, expect, it } from 'vitest';
import {
    selectionBarPlacement,
    selectionBarShown,
    selectionCountPlacement,
    selectionSummary,
} from './selection';

const element = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    type: 'rectangle',
    isDeleted: false,
    locked: false,
    groupIds: [] as string[],
    containerId: null,
    backgroundColor: '#fdf1c2',
    ...extra,
});
const view = { scrollX: 0, scrollY: 0, zoom: 1, width: 1440, height: 844 };

describe('selection', () => {
    it('is nothing when nothing live is selected', () => {
        expect(
            selectionSummary([element('a')], { selectedElementIds: {} }),
        ).toBeNull();
        expect(
            selectionSummary([element('a', { isDeleted: true })], {
                selectedElementIds: { a: true },
            }),
        ).toBeNull();
    });

    it('counts the selected elements, not their bound texts', () => {
        const summary = selectionSummary(
            [
                element('a'),
                element('b'),
                element('t', { type: 'text', containerId: 'a' }),
            ],
            {
                selectedElementIds: { a: true, b: true, t: true },
            },
        );

        expect(summary).toMatchObject({
            ids: ['a', 'b'],
            count: 2,
            units: 2,
            hasFill: true,
            canGroup: true,
            canUngroup: false,
        });
    });

    it('sees a group as one unit that can be ungrouped', () => {
        const summary = selectionSummary(
            [
                element('a', { groupIds: ['g'] }),
                element('b', { groupIds: ['g'] }),
            ],
            {
                selectedElementIds: { a: true, b: true },
            },
        );

        expect(summary).toMatchObject({
            count: 2,
            units: 1,
            canGroup: false,
            canUngroup: true,
        });
    });

    it('knows a selection without fill and a locked one', () => {
        const summary = selectionSummary(
            [element('l', { type: 'line', locked: true })],
            { selectedElementIds: { l: true } },
        );

        expect(summary).toMatchObject({
            hasFill: false,
            hasLocked: true,
            allLocked: true,
        });
    });

    it('hides the bar while editing text, dragging, resizing, rotating, drawing or in a dialog', () => {
        const ids = { selectedElementIds: { a: true } };

        expect(selectionBarShown(ids)).toBe(true);
        expect(selectionBarShown({ ...ids, editingTextElement: {} })).toBe(
            false,
        );
        expect(
            selectionBarShown({
                ...ids,
                selectedElementsAreBeingDragged: true,
            }),
        ).toBe(false);
        expect(selectionBarShown({ ...ids, isResizing: true })).toBe(false);
        expect(selectionBarShown({ ...ids, isRotating: true })).toBe(false);
        expect(selectionBarShown({ ...ids, newElement: {} })).toBe(false);
        expect(
            selectionBarShown({ ...ids, openDialog: { name: 'help' } }),
        ).toBe(false);
    });

    it('puts the bar under the selection, centred, inside the canvas', () => {
        expect(
            selectionBarPlacement(
                { x: 100, y: 546, width: 580, height: 140 },
                view,
                { width: 400, height: 44 },
            ),
        ).toEqual({
            left: 190,
            top: 698,
            side: 'below',
        });
        expect(
            selectionBarPlacement(
                { x: 0, y: 100, width: 100, height: 100 },
                view,
                { width: 400, height: 44 },
            ).left,
        ).toBe(16);
    });

    it('puts the bar above the selection and its count when there is no room below', () => {
        expect(
            selectionBarPlacement(
                { x: 100, y: 700, width: 200, height: 100 },
                view,
                { width: 200, height: 44 },
            ),
        ).toEqual({
            left: 100,
            top: 700 - 26 - 12 - 44,
            side: 'above',
        });
    });

    it('keeps the bar above the bars docked at the bottom of the canvas', () => {
        const below = selectionBarPlacement(
            { x: 100, y: 640, width: 200, height: 100 },
            view,
            { width: 200, height: 44 },
            80,
        );

        expect(below.side).toBe('above');
        expect(below.top + 44).toBeLessThanOrEqual(844 - 16 - 80);
        expect(
            selectionBarPlacement(
                { x: 100, y: 1000, width: 200, height: 100 },
                { ...view, height: 200 },
                { width: 200, height: 44 },
                80,
            ).top,
        ).toBe(200 - 16 - 80 - 44);
    });

    it('keeps the bar clear of the Styles panel on the left of the canvas', () => {
        expect(
            selectionBarPlacement(
                { x: 0, y: 100, width: 100, height: 100 },
                view,
                { width: 400, height: 44 },
                0,
                300,
            ).left,
        ).toBe(300 + 12);
        expect(
            selectionBarPlacement(
                { x: 800, y: 100, width: 100, height: 100 },
                view,
                { width: 400, height: 44 },
                0,
                300,
            ).left,
        ).toBe(650);
    });

    it('keeps the bar inside the canvas when the selection is scrolled above it', () => {
        expect(
            selectionBarPlacement(
                { x: 100, y: -500, width: 200, height: 100 },
                view,
                { width: 200, height: 44 },
            ),
        ).toEqual({ left: 100, top: 16, side: 'below' });
    });

    it('keeps the bar inside the canvas when the selection is scrolled below it', () => {
        expect(
            selectionBarPlacement(
                { x: 100, y: 2000, width: 200, height: 100 },
                view,
                { width: 200, height: 44 },
            ),
        ).toEqual({ left: 100, top: 844 - 16 - 44, side: 'above' });
    });

    it('follows the scroll and the zoom of the view', () => {
        expect(
            selectionCountPlacement(
                { x: 100, y: 200, width: 10, height: 10 },
                { ...view, scrollX: -50, scrollY: 10, zoom: 2 },
            ),
        ).toEqual({
            x: 100,
            y: 420 - 26,
            maxWidth: 1340,
        });
    });

    it('keeps the count inside the canvas when the selection starts left of the view', () => {
        expect(
            selectionCountPlacement(
                { x: -80, y: 200, width: 300, height: 10 },
                { ...view, width: 390 },
            ),
        ).toEqual({ x: 0, y: 174, maxWidth: 390 });
    });

    it('shows no count when the selection starts too far right to hold it', () => {
        expect(
            selectionCountPlacement(
                { x: 440, y: 80, width: 200, height: 200 },
                { ...view, width: 390 },
            ),
        ).toBeNull();
        expect(
            selectionCountPlacement(
                { x: 370, y: 80, width: 200, height: 200 },
                { ...view, width: 390 },
            ),
        ).toBeNull();
    });
});
