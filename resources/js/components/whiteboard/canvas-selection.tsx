import { useEffect, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import {
    WhiteboardSelectionBar,
    WhiteboardSelectionCount,
} from '@/components/skrum/whiteboard-selection-bar';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useTrans } from '@/hooks/use-trans';
import { colorBarState, filledSelection } from '@/lib/whiteboard/canvas-colors';
import type {
    ColorAppState,
    ColorElement,
} from '@/lib/whiteboard/canvas-colors';
import { runCanvasCommand } from '@/lib/whiteboard/canvas-commands';
import type { CanvasCommand } from '@/lib/whiteboard/canvas-commands';
import {
    CaptureUpdateAction,
    getCommonBounds,
} from '@/lib/whiteboard/excalidraw';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import { postItAppState, recolorElements } from '@/lib/whiteboard/palette';
import type { PostItColor } from '@/lib/whiteboard/palette';
import {
    EdgeMargin,
    selectionBarPlacement,
    selectionBarShown,
    selectionCountPlacement,
    selectionSummary,
} from '@/lib/whiteboard/selection';
import type {
    SelectableElement,
    SelectionState,
    SelectionSummary,
} from '@/lib/whiteboard/selection';
import type { Rect } from '@/lib/whiteboard/viewport';

type Props = {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    /** The board's canvas wrapper, home of the library's container that hears its own shortcuts. */
    canvas: RefObject<HTMLElement | null>;
    isFacilitator: boolean;
    editing: boolean;
    /** Lifted to the board, which shows the library's property panel (owner decision 2). */
    stylesShown: boolean;
    onStylesChange: (shown: boolean) => void;
    /** Pixels kept free at the bottom of the canvas for the bars docked there. */
    bottomInset?: number;
};

type BarSize = { width: number; height: number };

/** The right edge of the library's Styles panel, from the left of the canvas; laid out even while closed. */
function stylesPanelEdge(canvas: HTMLElement | null): number {
    const panel = canvas?.querySelector('.App-menu__left');

    if (!canvas || !panel) {
        return 0;
    }

    return (
        panel.getBoundingClientRect().right -
        canvas.getBoundingClientRect().left
    );
}

function boundsOf(snapshot: CanvasSnapshot, summary: SelectionSummary): Rect {
    const selected = snapshot.elements.filter((element) =>
        summary.ids.includes(element.id),
    );
    const [minX, minY, maxX, maxY] = getCommonBounds(selected as never);

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function groupControl(summary: SelectionSummary): 'group' | 'ungroup' | null {
    if (summary.canUngroup && summary.units === 1) {
        return 'ungroup';
    }

    if (summary.canGroup) {
        return 'group';
    }

    return null;
}

/**
 * The selection bar of ScreenWhiteboard under the selection, clear of the
 * open Styles panel, and its count chip on the selection's corner. Every command but the colours is the
 * library's own, reached through its shortcut (`runCanvasCommand`).
 */
export function CanvasSelection({
    api,
    snapshot,
    canvas,
    isFacilitator,
    editing,
    stylesShown,
    onStylesChange,
    bottomInset = 0,
}: Props): ReactElement | null {
    const { t } = useTrans();
    const [barSize, setBarSize] = useState<BarSize>({ width: 0, height: 0 });
    const [panelEdge, setPanelEdge] = useState(0);
    const state = snapshot.appState as unknown as SelectionState;
    const summary = editing
        ? selectionSummary(
              snapshot.elements as unknown as SelectableElement[],
              state,
          )
        : null;
    const hasSelection = summary !== null;

    useEffect(() => {
        if (hasSelection || !stylesShown) {
            return;
        }

        onStylesChange(false);
    }, [hasSelection, stylesShown, onStylesChange]);

    /** However the panel was shown (the bar's toggle, an earlier selection, the library's own menu), and again on a resize. */
    useEffect(() => {
        if (!stylesShown) {
            return;
        }

        const measure = (): void =>
            setPanelEdge(stylesPanelEdge(canvas.current));

        measure();
        window.addEventListener('resize', measure);

        return () => window.removeEventListener('resize', measure);
    }, [stylesShown, canvas]);

    if (summary === null || !selectionBarShown(state)) {
        return null;
    }

    const run = (command: CanvasCommand): void => {
        runCanvasCommand(canvas.current, command);
    };

    const recolour = (color: PostItColor): void => {
        const elements = api.getSceneElementsIncludingDeleted();
        const selected = filledSelection(
            elements as unknown as ColorElement[],
            api.getAppState().selectedElementIds,
        ).map((element) => element.id);

        api.updateScene({
            ...(selected.length > 0 && {
                elements: recolorElements(elements, selected, color),
            }),
            appState: postItAppState(color) as never,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
    };

    const lockedForMe = summary.hasLocked && !isFacilitator;
    const lockedReason = t('Only the facilitator can change a locked element.');
    const group = groupControl(summary);
    const bounds = boundsOf(snapshot, summary);
    const place = selectionBarPlacement(
        bounds,
        snapshot.view,
        barSize,
        bottomInset,
        stylesShown ? panelEdge : 0,
    );
    const corner = selectionCountPlacement(bounds, snapshot.view);

    return (
        <>
            {corner && (
                <WhiteboardSelectionCount
                    count={summary.count}
                    style={{
                        left: corner.x,
                        top: corner.y,
                        maxWidth: corner.maxWidth,
                    }}
                />
            )}
            <WhiteboardSelectionBar
                colour={
                    summary.hasFill
                        ? {
                              value: colorBarState(
                                  snapshot.elements as unknown as ColorElement[],
                                  snapshot.appState as unknown as ColorAppState,
                              ).value,
                              onChange: recolour,
                              disabled: lockedForMe,
                              reason: lockedForMe ? lockedReason : undefined,
                          }
                        : undefined
                }
                group={
                    group === null
                        ? null
                        : {
                              kind: group,
                              onPress: () => run(group),
                              disabled: lockedForMe,
                          }
                }
                align={{
                    enabled: summary.units >= 2 && !lockedForMe,
                    distribute: summary.units >= 3,
                    onCommand: run,
                }}
                lock={
                    isFacilitator
                        ? {
                              locked: summary.allLocked,
                              onPress: () => run('toggleLock'),
                          }
                        : undefined
                }
                styles={{
                    shown: stylesShown,
                    onToggle: () => onStylesChange(!stylesShown),
                    disabled: lockedForMe,
                }}
                remove={{
                    onPress: () => run('delete'),
                    disabled: lockedForMe,
                    reason: lockedForMe ? lockedReason : undefined,
                }}
                style={{
                    left: place.left,
                    top: place.top,
                    maxWidth: snapshot.view.width - 2 * EdgeMargin,
                }}
                onSize={setBarSize}
            />
        </>
    );
}
