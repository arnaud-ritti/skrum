import { describe, expect, it } from 'vitest';
import {
    colorBarState,
    filledSelection,
    strokeForTool,
    type ColorAppState,
} from '@/lib/whiteboard/canvas-colors';
import { DEFAULT_STROKE, POSTIT } from '@/lib/whiteboard/palette';

function appState(overrides: Partial<ColorAppState> = {}): ColorAppState {
    return {
        activeTool: { type: 'selection' },
        selectedElementIds: {},
        currentItemBackgroundColor: POSTIT.sun.bg,
        currentItemStrokeColor: DEFAULT_STROKE,
        openDialog: null,
        ...overrides,
    };
}

const note = { id: 'note', type: 'rectangle', backgroundColor: POSTIT.sky.bg };
const circle = {
    id: 'circle',
    type: 'ellipse',
    backgroundColor: POSTIT.sky.bg,
};
const label = { id: 'label', type: 'text', backgroundColor: 'transparent' };
const arrow = { id: 'arrow', type: 'arrow', backgroundColor: 'transparent' };

describe('colorBarState', () => {
    it('is hidden with the selection tool and nothing selected', () => {
        expect(colorBarState([note], appState())).toEqual({
            visible: false,
            value: null,
        });
    });

    it.each(['rectangle', 'diamond', 'ellipse'])(
        'shows the current fill for the %s tool',
        (type) => {
            expect(
                colorBarState(
                    [],
                    appState({
                        activeTool: { type },
                        currentItemBackgroundColor: POSTIT.moss.bg,
                    }),
                ),
            ).toEqual({ visible: true, value: 'moss' });
        },
    );

    it.each(['text', 'arrow', 'line', 'freedraw', 'eraser', 'hand', 'image'])(
        'is hidden for the %s tool, which has no fill',
        (type) => {
            expect(
                colorBarState([], appState({ activeTool: { type } })).visible,
            ).toBe(false);
        },
    );

    it('shows the colour of a selected note', () => {
        expect(
            colorBarState(
                [note, label],
                appState({ selectedElementIds: { note: true } }),
            ),
        ).toEqual({ visible: true, value: 'sky' });
    });

    it('is hidden when the selection has no fill', () => {
        expect(
            colorBarState(
                [note, label, arrow],
                appState({ selectedElementIds: { label: true, arrow: true } }),
            ).visible,
        ).toBe(false);
    });

    it('checks no colour for a selection of several colours', () => {
        expect(
            colorBarState(
                [note, { ...circle, backgroundColor: POSTIT.coral.bg }],
                appState({ selectedElementIds: { note: true, circle: true } }),
            ),
        ).toEqual({ visible: true, value: null });
    });

    it('checks no colour for a fill that is not one of the eight', () => {
        expect(
            colorBarState(
                [{ ...note, backgroundColor: '#a5d8ff' }],
                appState({ selectedElementIds: { note: true } }),
            ),
        ).toEqual({ visible: true, value: null });
    });

    it('gives way to a dialog of the canvas', () => {
        expect(
            colorBarState(
                [note],
                appState({
                    selectedElementIds: { note: true },
                    openDialog: { name: 'jsonExport' },
                }),
            ).visible,
        ).toBe(false);
    });
});

describe('filledSelection', () => {
    it('keeps the selected filled shapes that are not deleted', () => {
        expect(
            filledSelection(
                [note, circle, label, { ...note, id: 'gone', isDeleted: true }],
                { note: true, label: true, gone: true },
            ).map((element) => element.id),
        ).toEqual(['note']);
    });
});

describe('strokeForTool', () => {
    it('gives a new filled shape the border of its colour', () => {
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'rectangle' },
                    currentItemBackgroundColor: POSTIT.sky.bg,
                }),
            ),
        ).toBe(POSTIT.sky.stroke);
    });

    it('follows the fill from one border to another', () => {
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'ellipse' },
                    currentItemBackgroundColor: POSTIT.moss.bg,
                    currentItemStrokeColor: POSTIT.sky.stroke,
                }),
            ),
        ).toBe(POSTIT.moss.stroke);
    });

    it('asks for nothing once the border matches', () => {
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'rectangle' },
                    currentItemBackgroundColor: POSTIT.sky.bg,
                    currentItemStrokeColor: POSTIT.sky.stroke,
                }),
            ),
        ).toBeNull();
    });

    it.each(['text', 'freedraw', 'arrow', 'line', 'selection'])(
        'goes back to the default stroke for the %s tool',
        (type) => {
            expect(
                strokeForTool(
                    appState({
                        activeTool: { type },
                        currentItemStrokeColor: POSTIT.sun.stroke,
                    }),
                ),
            ).toBe(DEFAULT_STROKE);
        },
    );

    it('leaves a stroke the user chose alone', () => {
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'rectangle' },
                    currentItemStrokeColor: '#e03131',
                }),
            ),
        ).toBeNull();
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'text' },
                    currentItemStrokeColor: '#e03131',
                }),
            ),
        ).toBeNull();
    });

    it('leaves the default stroke alone on a filled shape when the user chose it over the border the app had set', () => {
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'rectangle' },
                    currentItemStrokeColor: DEFAULT_STROKE,
                }),
                POSTIT.sun.stroke,
            ),
        ).toBeNull();
    });

    it('still replaces the default stroke the app itself had set', () => {
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'ellipse' },
                    currentItemStrokeColor: DEFAULT_STROKE,
                }),
                DEFAULT_STROKE,
            ),
        ).toBe(POSTIT.sun.stroke);
    });

    it('follows the fill when the stroke is still the border the app set', () => {
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'rectangle' },
                    currentItemBackgroundColor: POSTIT.sky.bg,
                    currentItemStrokeColor: POSTIT.sun.stroke,
                }),
                POSTIT.sun.stroke,
            ),
        ).toBe(POSTIT.sky.stroke);
    });

    it('does not keep a note border on a shape whose fill is not one of the eight', () => {
        expect(
            strokeForTool(
                appState({
                    activeTool: { type: 'rectangle' },
                    currentItemBackgroundColor: 'transparent',
                    currentItemStrokeColor: POSTIT.sun.stroke,
                }),
            ),
        ).toBe(DEFAULT_STROKE);
    });
});
