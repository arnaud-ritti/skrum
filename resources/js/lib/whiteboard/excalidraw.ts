import '@excalidraw/excalidraw/index.css';
import '../../../css/excalidraw-theme.css';

export {
    CaptureUpdateAction,
    Excalidraw,
    getCommonBounds,
    MainMenu,
    reconcileElements,
    restoreElements,
    serializeAsJSON,
} from '@excalidraw/excalidraw';
export type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
export type {
    BinaryFiles,
    ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';

/**
 * Excalidraw 0.18.1 hardcodes the file type of its scene export ("Excalidraw
 * file", `.excalidraw`) and no prop changes it. Its "save to disk" action is
 * therefore switched off, including its Ctrl+Shift+S shortcut: the action
 * manager skips an action whose name is `false` in `canvasActions`, a key the
 * types do not list. Check this when the library is upgraded.
 */
export const HiddenSaveToDiskAction = { saveFileToDisk: false } as const;

/**
 * Markup of the shapes toolbar in Excalidraw 0.18.1, which has no prop or
 * component for adding a tool: where the eraser sits, what wraps a tool, and
 * the classes its own buttons carry (size, hover, focus and theme come with
 * them). Check these when the library is upgraded.
 */
export const ToolbarDom = {
    eraser: '.App-toolbar [data-testid="toolbar-eraser"]',
    tool: '.ToolIcon',
    buttonClass:
        'ToolIcon ToolIcon_type_button ToolIcon_size_medium ToolIcon_type_button--show',
    iconClass: 'ToolIcon__icon',
} as const;

/**
 * The text editor of Excalidraw 0.18.1 is a textarea it manages outside
 * React (`textWysiwyg`). It stays open, focused and writing into the scene
 * when the canvas goes to view mode, and nothing in the API closes it.
 * Escape is the one way out it always listens to; as it closes it writes
 * what it holds into its element and selects it.
 */
export function closeTextEditor(): void {
    document
        .querySelector('.excalidraw textarea.excalidraw-wysiwyg')
        ?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }),
        );
}
