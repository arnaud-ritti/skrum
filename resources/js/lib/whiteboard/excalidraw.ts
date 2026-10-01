import type { Excalidraw as ExcalidrawComponent } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI as Api } from '@excalidraw/excalidraw/types';
import type { ComponentProps } from 'react';

export {
    CaptureUpdateAction,
    Excalidraw,
    MainMenu,
    reconcileElements,
    restoreElements,
} from '@excalidraw/excalidraw';
export type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
export type {
    AppState,
    BinaryFileData,
    BinaryFiles,
    Collaborator,
    ExcalidrawImperativeAPI,
    SocketId,
} from '@excalidraw/excalidraw/types';

type Props = ComponentProps<typeof ExcalidrawComponent>;

export type RequiredApi = Pick<
    Api,
    | 'updateScene'
    | 'getSceneElementsIncludingDeleted'
    | 'getAppState'
    | 'getFiles'
    | 'addFiles'
>;

export type RequiredProps = Pick<
    Props,
    | 'excalidrawAPI'
    | 'initialData'
    | 'onChange'
    | 'onPointerUpdate'
    | 'onScrollChange'
    | 'viewModeEnabled'
    | 'renderTopRightUI'
    | 'UIOptions'
    | 'langCode'
    | 'theme'
>;

/**
 * Excalidraw 0.18.1 draws the canvas of the dark theme through the filter
 * `invert(93%) hue-rotate(180deg)` (its `THEME_FILTER`, not exported), so a
 * colour shown outside the canvas needs the same filter to look as it will
 * on it. Written out in full because Tailwind reads class names from source.
 */
export const CanvasDarkFilterClass =
    'dark:[filter:invert(93%)_hue-rotate(180deg)]';

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
