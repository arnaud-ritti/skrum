import { useEffect, useState } from 'react';
import type {
    AppState,
    ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { sceneStamp } from '@/lib/whiteboard/scene-stamp';
import type { SceneElement } from '@/lib/whiteboard/types';
import type { CanvasView } from '@/lib/whiteboard/viewport';

/** The part of the library's state the bars read; scroll, zoom and size go to `view`. */
export type CanvasAppState = Pick<
    AppState,
    | 'activeTool'
    | 'selectedElementIds'
    | 'editingTextElement'
    | 'selectedElementsAreBeingDragged'
    | 'isResizing'
    | 'isRotating'
    | 'newElement'
    | 'openDialog'
    | 'viewModeEnabled'
    | 'penMode'
    | 'penDetected'
    | 'currentItemBackgroundColor'
    | 'currentItemStrokeColor'
>;

type LibraryState = CanvasAppState &
    Pick<AppState, 'scrollX' | 'scrollY' | 'width' | 'height'> & {
        zoom: { value: number };
    };

export type CanvasSnapshot = {
    elements: readonly SceneElement[];
    appState: CanvasAppState;
    view: CanvasView;
    /** `sceneStamp(elements)`: changes when a live element changes; the minimap keys its work on it. */
    stamp: string;
};

type Held = { api: ExcalidrawImperativeAPI; snapshot: CanvasSnapshot };

function snapshotOf(
    elements: readonly SceneElement[],
    state: LibraryState,
): CanvasSnapshot {
    return {
        elements,
        appState: {
            activeTool: state.activeTool,
            selectedElementIds: state.selectedElementIds,
            editingTextElement: state.editingTextElement,
            selectedElementsAreBeingDragged:
                state.selectedElementsAreBeingDragged,
            isResizing: state.isResizing,
            isRotating: state.isRotating,
            newElement: state.newElement,
            openDialog: state.openDialog,
            viewModeEnabled: state.viewModeEnabled,
            penMode: state.penMode,
            penDetected: state.penDetected,
            currentItemBackgroundColor: state.currentItemBackgroundColor,
            currentItemStrokeColor: state.currentItemStrokeColor,
        },
        view: {
            scrollX: state.scrollX,
            scrollY: state.scrollY,
            zoom: state.zoom.value,
            width: state.width,
            height: state.height,
        },
        stamp: sceneStamp(elements),
    };
}

function readSnapshot(api: ExcalidrawImperativeAPI): CanvasSnapshot {
    return snapshotOf(
        api.getSceneElementsIncludingDeleted() as unknown as SceneElement[],
        api.getAppState(),
    );
}

/** The library's `onChange` as one state per animation frame; null until the canvas is ready. */
export function useCanvasSnapshot(
    api: ExcalidrawImperativeAPI | null,
): CanvasSnapshot | null {
    const [held, setHeld] = useState<Held | null>(null);
    const heldApi = held?.api ?? null;

    if (api !== heldApi) {
        setHeld(api === null ? null : { api, snapshot: readSnapshot(api) });
    }

    useEffect(() => {
        if (api === null) {
            return;
        }

        let latest: {
            elements: readonly SceneElement[];
            state: LibraryState;
        } | null = null;
        let frame: number | null = null;

        const flush = () => {
            frame = null;

            if (latest === null) {
                return;
            }

            setHeld({
                api,
                snapshot: snapshotOf(latest.elements, latest.state),
            });
        };

        const unsubscribe = api.onChange((elements, appState) => {
            latest = {
                elements: elements as unknown as SceneElement[],
                state: appState,
            };

            if (frame === null) {
                frame = requestAnimationFrame(flush);
            }
        });

        return () => {
            unsubscribe();

            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
        };
    }, [api]);

    return held?.snapshot ?? null;
}
