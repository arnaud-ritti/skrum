/**
 * The chrome of Excalidraw 0.18.1 that the board replaces with its own bars
 * (spec §5 rule 3). It is hidden with CSS under `.skrum-whiteboard--own-chrome`
 * (`resources/css/excalidraw-theme.css`), never removed: the hidden undo and
 * redo buttons are pressed by the history bar, and the property panel is
 * shown again by "Styles". Check this when the library is upgraded.
 */
export const NativeChrome = {
    container: '.excalidraw-container',
    toolbar: '.App-toolbar-container',
    zoom: '.layer-ui__wrapper__footer-left .zoom-actions',
    history: '.layer-ui__wrapper__footer-left .undo-redo-buttons',
    help: '.layer-ui__wrapper__footer-right',
    menu: '.main-menu-trigger',
    properties: '.selected-shape-actions',
    mobileBar: '.App-bottom-bar',
    /**
     * The phone layout's bottom row (`MobileMenu` of 0.18.1: the hamburger,
     * the shape-actions toggle, duplicate or finalize, delete, undo and
     * redo); the panel of shape actions above it stays, shown by "Styles".
     */
    mobileTools: '.excalidraw--mobile .App-bottom-bar .App-toolbar-content',
} as const;

export type NativeControl = 'undo' | 'redo';

/**
 * The test ids of the library's undo and redo buttons, which carry
 * `disabled` while their history is empty. Check this when the library is
 * upgraded.
 */
const NativeControlSelector: Record<NativeControl, string> = {
    undo: '[data-testid="button-undo"]',
    redo: '[data-testid="button-redo"]',
};

function nativeControl(
    canvas: HTMLElement | null,
    control: NativeControl,
): HTMLButtonElement | null {
    return (
        canvas?.querySelector<HTMLButtonElement>(
            NativeControlSelector[control],
        ) ?? null
    );
}

/** The library's own button knows whether its history is empty; nothing else exposes it. */
export function nativeControlEnabled(
    canvas: HTMLElement | null,
    control: NativeControl,
): boolean {
    const button = nativeControl(canvas, control);

    return button !== null && !button.disabled;
}

export function pressNativeControl(
    canvas: HTMLElement | null,
    control: NativeControl,
): boolean {
    if (!nativeControlEnabled(canvas, control)) {
        return false;
    }

    nativeControl(canvas, control)?.click();

    return true;
}

export type CanvasCommand =
    | 'group'
    | 'ungroup'
    | 'alignLeft'
    | 'alignRight'
    | 'alignTop'
    | 'alignBottom'
    | 'distributeHorizontally'
    | 'distributeVertically'
    | 'delete'
    | 'toggleLock'
    | 'clearCanvas';

type CommandKeysOf = {
    key: string;
    code?: string;
    mod?: boolean;
    shift?: boolean;
    alt?: boolean;
};

/**
 * Excalidraw 0.18.1 has no API for these actions; its own shortcuts reach
 * them (the `keyTest` of each action in `dist/dev/index.js`, and for
 * `clearCanvas` the mod+Delete branch of `App.onKeyDown`, which opens the
 * "clearCanvas" confirmation of `activeConfirmDialogAtom`). The key is
 * sent to the library's container, which listens for it while
 * `handleKeyboardGlobally` is off. Check this when the library is upgraded.
 */
export const CommandKeys: Readonly<Record<CanvasCommand, CommandKeysOf>> = {
    group: { key: 'g', mod: true },
    ungroup: { key: 'G', mod: true, shift: true },
    alignLeft: { key: 'ArrowLeft', mod: true, shift: true },
    alignRight: { key: 'ArrowRight', mod: true, shift: true },
    alignTop: { key: 'ArrowUp', mod: true, shift: true },
    alignBottom: { key: 'ArrowDown', mod: true, shift: true },
    distributeHorizontally: { key: 'h', code: 'KeyH', alt: true },
    distributeVertically: { key: 'v', code: 'KeyV', alt: true },
    delete: { key: 'Delete' },
    toggleLock: { key: 'L', mod: true, shift: true },
    /** Opens the library's own confirmation, not the clearing itself. */
    clearCanvas: { key: 'Delete', mod: true },
};

/** The library's own test of the command key (`isDarwin`). Check this when the library is upgraded. */
export function isApplePlatform(platform: string): boolean {
    return /Mac|iPod|iPhone|iPad/.test(platform);
}

export function commandEvent(
    command: CanvasCommand,
    apple: boolean,
): KeyboardEventInit {
    const keys = CommandKeys[command];
    const mod = keys.mod === true;

    return {
        key: keys.key,
        code: keys.code,
        bubbles: true,
        cancelable: true,
        shiftKey: keys.shift === true,
        altKey: keys.alt === true,
        metaKey: apple && mod,
        ctrlKey: !apple && mod,
    };
}

let warned = false;

export function runCanvasCommand(
    canvas: HTMLElement | null,
    command: CanvasCommand,
    platform: string = navigator.platform,
): boolean {
    const container =
        canvas?.querySelector<HTMLElement>(NativeChrome.container) ?? null;

    if (!container) {
        if (!warned) {
            warned = true;
            console.warn(
                `whiteboard: runCanvasCommand found no ${NativeChrome.container}`,
            );
        }

        return false;
    }

    container.dispatchEvent(
        new KeyboardEvent(
            'keydown',
            commandEvent(command, isApplePlatform(platform)),
        ),
    );

    return true;
}
