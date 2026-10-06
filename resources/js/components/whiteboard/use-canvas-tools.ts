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
import type { RefObject } from 'react';
import { addSticky } from '@/components/whiteboard/sticky-tool';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { isEditableTarget } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import { finishDrawing } from '@/lib/whiteboard/canvas-commands';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import type { PostItColor } from '@/lib/whiteboard/palette';
import {
    DefaultToolChoices,
    StickyToolType,
    ToolKeys,
    canvasToolFor,
    choicesAfter,
    toolOf,
} from '@/lib/whiteboard/tools';
import type {
    CanvasToolRequest,
    ToolChoices,
    WbTool,
} from '@/lib/whiteboard/tools';

/** The keys that change the tool: the bar's own, and K, the laser of "More tools". */
const ToolChangeKeys: readonly string[] = [
    ...Object.values(ToolKeys)
        .filter((key) => key !== null)
        .map((key) => key.toLowerCase()),
    'k',
];

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
    /** Every tool change of the board goes through here: the connector being drawn ends first. */
    setTool: (tool: CanvasToolRequest) => void;
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
 * A connector being drawn ends before the tool changes, by a bar or by a key.
 */
export function useCanvasTools(
    api: ExcalidrawImperativeAPI,
    snapshot: CanvasSnapshot,
    /** The board's canvas wrapper, home of the library's container that hears its own keys. */
    canvas: RefObject<HTMLElement | null>,
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

    /**
     * The library ignores its tool keys while a connector is being drawn, or
     * changes the tool and leaves it unfinished (H, K): the connector ends in
     * the capture phase, then the key reaches the library.
     */
    useEffect(() => {
        const wrapper = canvas.current;

        if (wrapper === null) {
            return;
        }

        const finishFirst = (event: KeyboardEvent): void => {
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            if (!ToolChangeKeys.includes(event.key.toLowerCase())) {
                return;
            }

            if (
                isEditableTarget(event.target) ||
                !singleKeyShortcutsEnabled()
            ) {
                return;
            }

            finishDrawing(api, wrapper);
        };

        wrapper.addEventListener('keydown', finishFirst, true);

        return () => wrapper.removeEventListener('keydown', finishFirst, true);
    }, [api, canvas]);

    const setTool = (tool: CanvasToolRequest): void => {
        finishDrawing(api, canvas.current);
        api.setActiveTool(tool);
    };

    return {
        choices,
        active: toolOf(libraryTool),
        viewMode,
        choose: (tool) => setTool(canvasToolFor(tool, choices)),
        setTool,
        hold: setHeld,
        addStickyInView: (color) => {
            finishDrawing(api, canvas.current);
            addSticky(api, color);

            if (libraryTool.locked) {
                return false;
            }

            api.setActiveTool({ type: 'selection' });

            return true;
        },
    };
}
