import { DEFAULT_POSTIT_COLOR, type PostItColor } from './palette';

export type WbTool =
    | 'select'
    | 'hand'
    | 'sticky'
    | 'shape'
    | 'connector'
    | 'text'
    | 'pen'
    | 'eraser'
    | 'frame'
    | 'image';
export type ShapeKind = 'rectangle' | 'diamond' | 'ellipse';
export type ConnectorKind = 'arrow' | 'line';
export type ToolChoices = {
    shape: ShapeKind;
    connector: ConnectorKind;
    sticky: PostItColor;
};

export const ShapeKinds: readonly ShapeKind[] = [
    'rectangle',
    'diamond',
    'ellipse',
];
export const ConnectorKinds: readonly ConnectorKind[] = ['arrow', 'line'];
export const DefaultToolChoices: ToolChoices = {
    shape: 'rectangle',
    connector: 'arrow',
    sticky: DEFAULT_POSTIT_COLOR,
};

/** The library's custom tool (`setActiveTool({type: 'custom'})`) that places a sticky note. */
export const StickyToolType = 'skrum-sticky';

/** Owner decision 1 (spec §15): N; the library's S opens its stroke picker. */
export const StickyKey = 'N';

/** ScreenWhiteboard's vertical bar, separators between the groups. */
export const ToolGroups: readonly (readonly WbTool[])[] = [
    ['select', 'hand'],
    ['sticky', 'shape', 'connector', 'text', 'pen', 'eraser', 'frame'],
    ['image'],
];

/** MobileRituals: the bottom bar; the drawer of "…" holds the rest, without connector or frame under `md`. */
export const PhoneBarTools: readonly WbTool[] = ['select', 'sticky', 'pen'];
export const PhoneDrawerTools: readonly WbTool[] = [
    'hand',
    'shape',
    'text',
    'eraser',
    'image',
];

export const ToolKeys: Readonly<Record<WbTool, string | null>> = {
    select: 'V',
    hand: 'H',
    sticky: StickyKey,
    shape: 'R',
    connector: 'C',
    text: 'T',
    pen: 'P',
    eraser: 'E',
    frame: 'F',
    image: null,
};

/** The keys of `ToolKeys` the library does not answer to: the board answers them. */
export const BoardToolKeys: readonly WbTool[] = ['sticky', 'connector'];

export type CanvasActiveTool = { type: string; customType?: string | null };
export type CanvasToolRequest =
    | { type: 'custom'; customType: string }
    | {
          type:
              | 'selection'
              | 'hand'
              | ShapeKind
              | ConnectorKind
              | 'text'
              | 'freedraw'
              | 'eraser'
              | 'frame'
              | 'image';
      };

const ToolOfType: Readonly<Record<string, WbTool>> = {
    selection: 'select',
    hand: 'hand',
    rectangle: 'shape',
    diamond: 'shape',
    ellipse: 'shape',
    arrow: 'connector',
    line: 'connector',
    text: 'text',
    freedraw: 'pen',
    eraser: 'eraser',
    frame: 'frame',
    image: 'image',
};

export function toolOf(active: CanvasActiveTool): WbTool | null {
    if (active.type === 'custom') {
        return active.customType === StickyToolType ? 'sticky' : null;
    }

    return ToolOfType[active.type] ?? null;
}

export function choicesAfter(
    active: CanvasActiveTool,
    choices: ToolChoices,
): ToolChoices {
    const shape = ShapeKinds.find((kind) => kind === active.type);

    if (shape && shape !== choices.shape) {
        return { ...choices, shape };
    }

    const connector = ConnectorKinds.find((kind) => kind === active.type);

    if (connector && connector !== choices.connector) {
        return { ...choices, connector };
    }

    return choices;
}

export function canvasToolFor(
    tool: WbTool,
    choices: ToolChoices,
): CanvasToolRequest {
    switch (tool) {
        case 'select':
            return { type: 'selection' };
        case 'sticky':
            return { type: 'custom', customType: StickyToolType };
        case 'shape':
            return { type: choices.shape };
        case 'connector':
            return { type: choices.connector };
        case 'pen':
            return { type: 'freedraw' };
        default:
            return { type: tool };
    }
}
