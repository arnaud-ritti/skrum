import type { LucideIcon } from 'lucide-react';
import {
    Eraser,
    Frame,
    Hand,
    Image,
    MousePointer2,
    Pencil,
    Shapes,
    Spline,
    StickyNote,
    Type,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addSticky } from '@/components/whiteboard/sticky-tool';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useTrans } from '@/hooks/use-trans';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import type { PostItColor } from '@/lib/whiteboard/palette';
import {
    DefaultToolChoices,
    StickyToolType,
    canvasToolFor,
    choicesAfter,
    toolOf,
} from '@/lib/whiteboard/tools';
import type { ToolChoices, WbTool } from '@/lib/whiteboard/tools';

export const ToolIcons: Readonly<Record<WbTool, LucideIcon>> = {
    select: MousePointer2,
    hand: Hand,
    sticky: StickyNote,
    shape: Shapes,
    connector: Spline,
    text: Type,
    pen: Pencil,
    eraser: Eraser,
    frame: Frame,
    image: Image,
};

export function useToolLabels(): Record<WbTool, string> {
    const { t } = useTrans();

    return {
        select: t('Selection'),
        hand: t('Hand'),
        sticky: t('Sticky note'),
        shape: t('Shape'),
        connector: t('Connector'),
        text: t('Text'),
        pen: t('Pencil'),
        eraser: t('Eraser'),
        frame: t('Frame'),
        image: t('Image'),
    };
}

export type CanvasToolsState = {
    /** The kinds and the sticky colour the next press of a tool uses. */
    choices: ToolChoices;
    /** The board's tool the library has on, null for one the bar does not show (the laser). */
    active: WbTool | null;
    viewMode: boolean;
    choose: (tool: WbTool) => void;
    hold: (choices: ToolChoices) => void;
    /**
     * A sticky of that colour in the middle of the view (the keyboard path);
     * true when the tool went back to the selection, false when it is kept.
     */
    addStickyInView: (color: PostItColor) => boolean;
};

/**
 * The tool logic the desktop bar and the phone's bar share: the library's
 * active tool as a board tool, the last shape, connector and sticky colour,
 * and sticky placement while the sticky tool is on (a press on the canvas
 * adds a note there and returns to the selection unless the tool is kept).
 */
export function useCanvasTools(
    api: ExcalidrawImperativeAPI,
    snapshot: CanvasSnapshot,
): CanvasToolsState {
    const [held, setHeld] = useState<ToolChoices>(DefaultToolChoices);
    const libraryTool = snapshot.appState.activeTool;
    const choices = choicesAfter(libraryTool, held);
    const viewMode = snapshot.appState.viewModeEnabled;
    const stickyColor = useRef<PostItColor>(choices.sticky);
    const isViewMode = useRef(viewMode);

    if (choices !== held) {
        setHeld(choices);
    }

    useEffect(() => {
        stickyColor.current = choices.sticky;
        isViewMode.current = viewMode;
    });

    useEffect(
        () =>
            api.onPointerDown((tool, pointerDownState) => {
                if (
                    tool.type !== 'custom' ||
                    tool.customType !== StickyToolType
                ) {
                    return;
                }

                if (isViewMode.current || api.getAppState().viewModeEnabled) {
                    return;
                }

                addSticky(api, stickyColor.current, pointerDownState.origin);

                if (tool.locked) {
                    return;
                }

                // After the library's own pointer-up, which reads the tool it started with.
                const backToSelection = (): void => {
                    window.removeEventListener('pointerup', backToSelection);
                    window.removeEventListener(
                        'pointercancel',
                        backToSelection,
                    );
                    api.setActiveTool({ type: 'selection' });
                };

                window.addEventListener('pointerup', backToSelection);
                window.addEventListener('pointercancel', backToSelection);
            }),
        [api],
    );

    return {
        choices,
        active: toolOf(libraryTool),
        viewMode,
        choose: (tool) => api.setActiveTool(canvasToolFor(tool, choices)),
        hold: setHeld,
        addStickyInView: (color) => {
            addSticky(api, color);

            if (libraryTool.locked) {
                return false;
            }

            api.setActiveTool({ type: 'selection' });

            return true;
        },
    };
}
