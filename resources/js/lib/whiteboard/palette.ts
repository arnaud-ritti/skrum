export const PostItColors = [
    'sun',
    'apricot',
    'coral',
    'plum',
    'iris',
    'sky',
    'lagoon',
    'moss',
] as const;

export type PostItColor = (typeof PostItColors)[number];

type PostItSwatch = {
    bg: string;
    stroke: string;
};

/**
 * Literal light-theme values of the --skrum-col-* and --skrum-col-*-border
 * tokens. Scene colours are stored in the shared scene, so they must be
 * literals, never var(--token) and never dark values (Excalidraw inverts the
 * canvas in dark mode).
 */
export const POSTIT: Record<PostItColor, PostItSwatch> = {
    sun: { bg: '#fdf1c2', stroke: '#ddc362' },
    apricot: { bg: '#ffecdd', stroke: '#efb787' },
    coral: { bg: '#ffebe8', stroke: '#f9aea4' },
    plum: { bg: '#ffe9f4', stroke: '#efadd1' },
    iris: { bg: '#efeeff', stroke: '#c3bbfb' },
    sky: { bg: '#e2f3ff', stroke: '#8dccf9' },
    lagoon: { bg: '#cefaf9', stroke: '#78d7d6' },
    moss: { bg: '#e1f8dc', stroke: '#a5d39b' },
};

export const DEFAULT_POSTIT_COLOR: PostItColor = 'sun';

/** Light value of --skrum-canvas, stored as the scene background. */
export const CANVAS_LIGHT = '#f8f5f1';

export type CanvasBackgroundKey =
    | 'Paper'
    | 'White'
    | 'Light grey'
    | 'Light blue'
    | 'Light yellow'
    | 'Light beige';

/**
 * The "Canvas background" choices of the board menu: the paper, then the five
 * picks of the library's own picker (`DEFAULT_CANVAS_BACKGROUND_PICKS` of
 * 0.18.1). Canvas data, local to the browser. Check this when the library is
 * upgraded.
 */
export const CanvasBackgrounds: readonly {
    key: CanvasBackgroundKey;
    value: string;
}[] = [
    { key: 'Paper', value: CANVAS_LIGHT },
    { key: 'White', value: '#ffffff' },
    { key: 'Light grey', value: '#f8f9fa' },
    { key: 'Light blue', value: '#f5faff' },
    { key: 'Light yellow', value: '#fffce8' },
    { key: 'Light beige', value: '#fdf8f6' },
];

/**
 * The scene background as the canvas paints it: the chosen colour with no
 * alpha, so the board's dot grid under the canvas shows (ScreenWhiteboard,
 * D-75). An export dialog gets the opaque colour back.
 */
export function seeThroughBackground(color: string): string {
    return `${opaqueBackground(color)}00`;
}

export function opaqueBackground(color: string): string {
    return color.slice(0, 7);
}

/**
 * Excalidraw's own default stroke: what lines, arrows, pencil strokes and
 * text are drawn in, so that they stay readable on the canvas and on a note.
 */
export const DEFAULT_STROKE = '#1e1e1e';

export function isPostItColor(value: unknown): value is PostItColor {
    return (
        typeof value === 'string' &&
        (PostItColors as readonly string[]).includes(value)
    );
}

export function postItFromBackground(background: string): PostItColor | null {
    const wanted = background.toLowerCase();

    return PostItColors.find((color) => POSTIT[color].bg === wanted) ?? null;
}

export function postItFromStroke(stroke: string): PostItColor | null {
    const wanted = stroke.toLowerCase();

    return (
        PostItColors.find((color) => POSTIT[color].stroke === wanted) ?? null
    );
}

export function postItAppState(color: PostItColor): {
    currentItemBackgroundColor: string;
    currentItemStrokeColor: string;
    currentItemFillStyle: 'solid';
} {
    return {
        currentItemBackgroundColor: POSTIT[color].bg,
        currentItemStrokeColor: POSTIT[color].stroke,
        currentItemFillStyle: 'solid',
    };
}

type ColourableElement = {
    id: string;
    version: number;
    versionNonce: number;
    backgroundColor: string;
    strokeColor: string;
    fillStyle: string;
};

/**
 * Applies a post-it colour to the selected elements only. Bumps version and
 * versionNonce so the change wins the version/versionNonce diff relayed to the
 * other participants.
 */
export function recolorElements<T extends ColourableElement>(
    elements: readonly T[],
    selectedIds: ReadonlySet<string> | readonly string[],
    color: PostItColor,
): T[] {
    const selected = new Set(selectedIds);

    return elements.map((element) => {
        if (!selected.has(element.id)) {
            return element;
        }

        return {
            ...element,
            backgroundColor: POSTIT[color].bg,
            strokeColor: POSTIT[color].stroke,
            fillStyle: 'solid',
            version: element.version + 1,
            versionNonce: Math.floor(Math.random() * 2 ** 31),
        };
    });
}
