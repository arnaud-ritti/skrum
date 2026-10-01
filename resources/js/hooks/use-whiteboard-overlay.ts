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
    isDeleted: boolean;
    customData?: Record<string, unknown>;
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
