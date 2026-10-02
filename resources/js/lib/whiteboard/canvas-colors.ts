import {
    DEFAULT_STROKE,
    POSTIT,
    postItFromBackground,
    postItFromStroke,
    type PostItColor,
} from './palette';

/** The shapes that are filled the way a sticky note is. */
const FilledTypes: readonly string[] = ['rectangle', 'diamond', 'ellipse'];

export type ColorElement = {
    id: string;
    type: string;
    isDeleted?: boolean;
    backgroundColor: string;
};

export type ColorAppState = {
    activeTool: { type: string };
    selectedElementIds: Readonly<Record<string, boolean>>;
    currentItemBackgroundColor: string;
    currentItemStrokeColor: string;
    openDialog?: unknown;
};

export type ColorBarState = {
    visible: boolean;
    /** Null when the fill is none of the eight, or when the selection has several. */
    value: PostItColor | null;
};

export const HiddenColorBar: ColorBarState = { visible: false, value: null };

function hasFill(type: string): boolean {
    return FilledTypes.includes(type);
}

/** The selected elements the colour bar recolours. */
export function filledSelection(
    elements: readonly ColorElement[],
    selectedIds: Readonly<Record<string, boolean>>,
): ColorElement[] {
    if (!Object.values(selectedIds).some(Boolean)) {
        return [];
    }

    return elements.filter(
        (element) =>
            selectedIds[element.id] === true &&
            element.isDeleted !== true &&
            hasFill(element.type),
    );
}

/**
 * The colour bar is there for a selection that has a fill and for a tool that
 * draws one (answer 7-D3). It gives way to the canvas's own dialogs.
 */
export function colorBarState(
    elements: readonly ColorElement[],
    appState: ColorAppState,
): ColorBarState {
    if (appState.openDialog) {
        return HiddenColorBar;
    }

    const selection = filledSelection(elements, appState.selectedElementIds);

    if (selection.length > 0) {
        const [first, ...others] = selection.map((element) =>
            postItFromBackground(element.backgroundColor),
        );

        return {
            visible: true,
            value: others.every((color) => color === first) ? first : null,
        };
    }

    if (!hasFill(appState.activeTool.type)) {
        return HiddenColorBar;
    }

    return {
        visible: true,
        value: postItFromBackground(appState.currentItemBackgroundColor),
    };
}

/**
 * A new filled shape takes the border of its colour, as a sticky note does.
 * Every other tool goes back to the default stroke: text, a line or a pencil
 * stroke in a note's border colour could not be read. A stroke the user chose
 * is left alone: only one of the eight borders, or the stroke this function
 * returned last (`appliedStroke`, the default one at first), is replaced, so
 * the default stroke picked over a border stays. Returns the stroke to set,
 * or null when the current one is right.
 */
export function strokeForTool(
    appState: ColorAppState,
    appliedStroke: string = DEFAULT_STROKE,
): string | null {
    const current = appState.currentItemStrokeColor.toLowerCase();
    const fromPalette = postItFromStroke(current) !== null;

    if (!hasFill(appState.activeTool.type)) {
        return fromPalette ? DEFAULT_STROKE : null;
    }

    const fill = postItFromBackground(appState.currentItemBackgroundColor);

    if (fill === null) {
        return fromPalette ? DEFAULT_STROKE : null;
    }

    if (current !== appliedStroke.toLowerCase() && !fromPalette) {
        return null;
    }

    return current === POSTIT[fill].stroke ? null : POSTIT[fill].stroke;
}
