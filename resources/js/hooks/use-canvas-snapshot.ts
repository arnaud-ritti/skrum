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
    | 'viewBackgroundColor'
    | 'openMenu'
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
            viewBackgroundColor: state.viewBackgroundColor,
            openMenu: state.openMenu,
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

function sameEntries(previous: unknown, next: unknown): boolean {
    if (Object.is(previous, next)) {
        return true;
    }

    if (
        typeof previous !== 'object' ||
        typeof next !== 'object' ||
        previous === null ||
        next === null
    ) {
        return false;
    }

    const previousKeys = Object.keys(previous);

    return (
        previousKeys.length === Object.keys(next).length &&
        previousKeys.every((key) =>
            Object.is(
                (previous as Record<string, unknown>)[key],
                (next as Record<string, unknown>)[key],
            ),
        )
    );
}

/**
 * The library reports a change on every update of its own, even one that
 * changed nothing: a snapshot that would hold the same scene (the library
 * keeps the array while no element changes), view and state is not taken.
 */
function unchanged(
    snapshot: CanvasSnapshot,
    elements: readonly SceneElement[],
    state: LibraryState,
): boolean {
    const { view, appState } = snapshot;

    return (
        snapshot.elements === elements &&
        view.scrollX === state.scrollX &&
        view.scrollY === state.scrollY &&
        view.zoom === state.zoom.value &&
        view.width === state.width &&
        view.height === state.height &&
        (Object.keys(appState) as (keyof CanvasAppState)[]).every((key) =>
            sameEntries(appState[key], state[key]),
        )
    );
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

            const { elements, state } = latest;

            setHeld((previous) =>
                previous !== null &&
                previous.api === api &&
                unchanged(previous.snapshot, elements, state)
                    ? previous
                    : { api, snapshot: snapshotOf(elements, state) },
            );
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
