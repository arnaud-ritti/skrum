import '@excalidraw/excalidraw/index.css';
import '../../../css/excalidraw-theme.css';

export {
    CaptureUpdateAction,
    Excalidraw,
    exportToBlob,
    exportToSvg,
    getCommonBounds,
    MainMenu,
    reconcileElements,
    restoreElements,
    serializeAsJSON,
} from '@excalidraw/excalidraw';
export type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
export type {
    AppState,
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

/**
 * The library's default sidebar and its search tab (`DEFAULT_SIDEBAR` and
 * `CANVAS_SEARCH_TAB` of 0.18.1), which "Find on canvas" opens. Check this
 * when the library is upgraded.
 */
export const CanvasSearchSidebar = { name: 'default', tab: 'search' } as const;

/**
 * The field of that search tab (`CLASSES.SEARCH_MENU_INPUT_WRAPPER` of 0.18.1):
 * the library focuses it only on its own Ctrl+F, so "Find on canvas" focuses
 * it. Check this when the library is upgraded.
 */
export const CanvasSearchInput = '.layer-ui__search-inputWrapper input';
