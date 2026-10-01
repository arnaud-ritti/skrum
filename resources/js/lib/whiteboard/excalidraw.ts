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
