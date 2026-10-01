import { useEffect, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

export type CanvasView = { scrollX: number; scrollY: number; zoom: number };

export type NoteBox = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

type CanvasElement = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
    isDeleted: boolean;
    customData?: Record<string, unknown>;
    boundElements?: readonly { id: string; type: string }[] | null;
};

/** Scroll and zoom of the canvas, for anything drawn above it. */
export function useCanvasView(
    api: ExcalidrawImperativeAPI | null,
): CanvasView | null {
    const [view, setView] = useState<CanvasView | null>(null);

    useEffect(() => {
        if (!api) {
            return;
        }

        const { scrollX, scrollY, zoom } = api.getAppState();

        setView({ scrollX, scrollY, zoom: zoom.value });

        return api.onScrollChange((nextX, nextY, nextZoom) =>
            setView({ scrollX: nextX, scrollY: nextY, zoom: nextZoom.value }),
        );
    }, [api]);

    return view;
}

const isSticky = (element: CanvasElement) =>
    (element.customData?.skrum as { kind?: unknown } | undefined)?.kind ===
    'sticky';

/**
 * Where the given sticky notes are, in scene coordinates. `ids` must keep
 * its identity between renders (useMemo), or the subscription restarts.
 */
export function useNoteBoxes(
    api: ExcalidrawImperativeAPI | null,
    ids: readonly string[] | null,
): NoteBox[] {
    const [boxes, setBoxes] = useState<NoteBox[]>([]);

    useEffect(() => {
        if (!api || ids === null) {
            setBoxes([]);

            return;
        }

        const wanted = new Set(ids);
        let signature = '';

        const read = (elements: readonly CanvasElement[]) => {
            const next = elements
                .filter(
                    (element) =>
                        wanted.has(element.id) &&
                        !element.isDeleted &&
                        isSticky(element),
                )
                .map(({ id, x, y, width, height }) => ({
                    id,
                    x,
                    y,
                    width,
                    height,
                }));
            const nextSignature = next
                .map((box) => Object.values(box).join(':'))
                .join('|');

            // onChange also fires on every selection and pointer state.
            if (nextSignature === signature) {
                return;
            }

            signature = nextSignature;
            setBoxes(next);
        };

        read(api.getSceneElements());

        return api.onChange((elements) => read(elements));
    }, [api, ids]);

    return boxes;
}

const idsOnBoard = (
    api: ExcalidrawImperativeAPI,
    ids: readonly string[],
): string[] => {
    const wanted = new Set(ids);

    return api
        .getSceneElements()
        .filter((element) => wanted.has(element.id))
        .map((element) => element.id);
};

/**
 * Which of the given elements are on the canvas now. `ids` must keep its
 * identity between renders (useMemo), or the subscription restarts.
 */
export function useElementsOnBoard(
    api: ExcalidrawImperativeAPI,
    ids: readonly string[],
): ReadonlySet<string> {
    const [onBoard, setOnBoard] = useState(() => idsOnBoard(api, ids));

    useEffect(() => {
        const read = () => {
            const next = idsOnBoard(api, ids);

            // onChange also fires on every selection and pointer state.
            setOnBoard((current) =>
                current.join('|') === next.join('|') ? current : next,
            );
        };

        read();

        return api.onChange(read);
    }, [api, ids]);

    return new Set(onBoard);
}

export type MaskedNoteBox = NoteBox & { angle: number };

const isMasked = (element: CanvasElement) =>
    (element.customData?.skrum as { masked?: unknown } | undefined)?.masked ===
    true;

/**
 * The notes whose text this viewer was not given (spec §11.5), in scene
 * coordinates. A masked note someone copied and typed into has a live text
 * of its own and is left out.
 */
export function useMaskedNoteBoxes(
    api: ExcalidrawImperativeAPI | null,
): MaskedNoteBox[] {
    const [boxes, setBoxes] = useState<MaskedNoteBox[]>([]);

    useEffect(() => {
        if (!api) {
            setBoxes([]);

            return;
        }

        let signature = '';

        const read = (elements: readonly CanvasElement[]) => {
            const live = new Set(
                elements
                    .filter((element) => !element.isDeleted)
                    .map((element) => element.id),
            );
            const next = elements
                .filter(
                    (element) =>
                        !element.isDeleted &&
                        isMasked(element) &&
                        !(element.boundElements ?? []).some(
                            (bound) =>
                                bound.type === 'text' && live.has(bound.id),
                        ),
                )
                .map(({ id, x, y, width, height, angle }) => ({
                    id,
                    x,
                    y,
                    width,
                    height,
                    angle: angle ?? 0,
                }));
            const nextSignature = next
                .map((box) => Object.values(box).join(':'))
                .join('|');

            // onChange also fires on every selection and pointer state.
            if (nextSignature === signature) {
                return;
            }

            signature = nextSignature;
            setBoxes(next);
        };

        read(api.getSceneElements());

        return api.onChange((elements) => read(elements));
    }, [api]);

    return boxes;
}
